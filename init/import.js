
const fs = require('fs')

const host = process.argv[2] || 'localhost';
const port = process.argv[3] || 7432;

const { Client } = require('pg')

let client
if (process.env.DATABASE_URL) {
    let login = process.env.DATABASE_URL;
    console.log('connecting as ', login);
    client = new Client({
        connectionString: login,
    })
} else {
    client = new Client({
        user: 'postgres',
        host: host,
        database: 'blockscout',
        port: port,
    })
}

const datadir = __dirname + '/exports/';

const query = async (text, args) => {
    args = args || [];
    return (await client.query(text, args)).rows;
}
const read = (file) => {
    const path = datadir + file;
    return JSON.parse(fs.readFileSync(path).toString());
}

const prepare = (data, offset) => {
    let width = data[0].length;
    let num = 1 + (offset || 0);
    let prepared = data.map((x, index) => {
        let string = `($${num++}`;
        for (let i = 1; i < width; i++) {
            string += `, $${num++}`;
        }
        string += ')';
        return string
    });
    let inserts = [prepared.join(', ')];
    let values = data.flat();
    return [values, inserts];
}

const conflicts = (keys) => {
    let columns = keys.replace(/\s+/g, '').split(',');
    return columns.map(x => `${x} = EXCLUDED.${x}`).join(', ');
}

(async () => {
    await client.connect();
    const now = new Date();
    let [content, inserts] = [{}, {}];
    let update, columns;

    let migrations = read('migrations.json').map(x => [x.version, now]);
    [content, inserts] = prepare(migrations);
    await query(
        `INSERT INTO schema_migrations(version, inserted_at) VALUES ${inserts} ON CONFLICT DO NOTHING;`,
        content
    );

    let methods = read('methods.json').map(x => [x.identifier, x.type, x.abi, now, now]);
    [content, inserts] = prepare(methods);
    update = conflicts('identifier, type, abi');
    await query(
        `INSERT INTO contract_methods(identifier, type, abi, inserted_at, updated_at) 
         VALUES ${inserts} ON CONFLICT (identifier, abi) DO UPDATE SET ${update};`,
        content,
    );

    let contracts = [];
    let names = [];
    let addresses = [];
    let additional_sources = [];
    let verifications = [];
    let decompiled = [];

    let files = fs.readdirSync(datadir + 'contracts/')
    for (const file of files) {
        const c = read('contracts/' + file);

        const hash = Buffer.from(c.address_hash.data);
        const abi = JSON.stringify(c.abi);
        const external_libraries = c.external_libraries.map(x => JSON.stringify(x));
        contracts.push([
            c.name, c.compiler_version, c.optimization, c.contract_source_code, abi, hash, now, now,
            c.constructor_arguments, c.optimization_runs, c.evm_version, external_libraries, c.verified_via_sourcify,
            c.is_vyper_contract, c.partially_verified, c.file_path, c.is_changed_bytecode, c.bytecode_checked_at,
            c.contract_code_md5, c.implementation_name
        ]);

        const contract_code = Buffer.from(c.contract_code);
        addresses.push([hash, contract_code, now, now, c.decompiled, c.verified]);

        if (c.primary !== null) {
            const primary = c.primary || false;
            const metadata = JSON.stringify(c.metadata);
            names.push([hash, c.name, primary, now, now, metadata]);
        }
        if (c.file_name !== null) {
            additional_sources.push([c.file_name, c.additional_source, hash, now, now]);
        }
        if (c.uid !== null) {
            verifications.push([c.uid, c.status, hash, now, now]);
        }
        if (c.decompiler_version !== null) {
            decompiled.push([c.decompiler_version, c.decompiled_source_code, hash, now, now]);
        }
    }

    if (addresses.length > 0) {
        columns = `hash, contract_code, inserted_at, updated_at, decompiled, verified`;
        [content, inserts] = prepare(addresses);
        update = conflicts(columns);
        await query(
            `INSERT INTO addresses(${columns}) VALUES ${inserts} ON CONFLICT (hash) DO UPDATE SET ${update};`,
            content
        );
    }

    if (names.length > 0) {
        columns = `address_hash, name, "primary", inserted_at, updated_at, metadata`;
        [content, inserts] = prepare(names);
        update = conflicts(columns);
        await query(
            `INSERT INTO address_names(${columns})
             VALUES ${inserts} ON CONFLICT (address_hash, name) DO UPDATE SET ${update};`,
            content
        );
    }

    if (contracts.length > 0) {
        columns =
            `name, compiler_version, optimization, contract_source_code, abi, address_hash, inserted_at, updated_at,
             constructor_arguments, optimization_runs, evm_version, external_libraries, verified_via_sourcify,
             is_vyper_contract, partially_verified, file_path, is_changed_bytecode, bytecode_checked_at,
             contract_code_md5, implementation_name`;
        [content, inserts] = prepare(contracts);
        update = conflicts(columns);
        await query(
            `INSERT INTO smart_contracts(${columns})
             VALUES ${inserts} ON CONFLICT (address_hash) DO UPDATE SET ${update};`,
            content
        );
    }

    if (verifications.length > 0) {
        columns = `uid, status, address_hash, inserted_at, updated_at`;
        [content, inserts] = prepare(verifications);
        update = conflicts(columns);
        await query(
            `INSERT INTO contract_verification_status(${columns})
             VALUES ${inserts} ON CONFLICT (uid) DO UPDATE SET ${update};`,
            content
        );
    }

    if (decompiled.length > 0) {
        columns = `decompiler_version, decompiled_source_code, address_hash, inserted_at, updated_at`;
        [content, inserts] = prepare(decompiled);
        update = conflicts(columns);
        await query(
            `INSERT INTO decompiled_smart_contracts(${columns})
             VALUES ${inserts} ON CONFLICT (address_hash, decompiler_version) DO UPDATE SET ${update};`,
            content
        );
    }

    if (additional_sources.length > 0) {
        // unfortunately blockscout allows duplicates in this table, so we have to delete the ones already present
        const file_names            = additional_sources.map(x => [x[0]]);
        const contract_source_codes = additional_sources.map(x => [x[1]]);
        const address_hashes        = additional_sources.map(x => [x[2]]);

        const [f_content, f_inserts] = prepare(file_names);
        const [c_content, c_inserts] = prepare(contract_source_codes, f_content.length);
        const [a_content, a_inserts] = prepare(address_hashes       , f_content.length + c_content.length);

        await query(
            `DELETE FROM smart_contracts_additional_sources
             WHERE file_name IN (${f_inserts}) AND contract_source_code IN (${c_inserts})
             AND address_hash IN (${a_inserts});`,
            [f_content, c_content, a_content].flat()
        );

        columns = `file_name, contract_source_code, address_hash, inserted_at, updated_at`;
        [content, inserts] = prepare(additional_sources);
        update = conflicts(columns);
        await query(`INSERT INTO smart_contracts_additional_sources(${columns}) VALUES ${inserts};`, content);
    }

    console.log(`successfully imported ${contracts.length} contracts`)
    await client.end();
})();
