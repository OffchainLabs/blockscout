
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

if (!fs.existsSync(datadir)){
    fs.mkdirSync(datadir + 'contracts', { recursive: true });
}

const query = async (text) => {
    return (await client.query(text)).rows;
}
const write = (file, json) => {
    const path = datadir + file;
    fs.writeFileSync(path, JSON.stringify(json) + '\n');
}


(async () => {
    await client.connect()

    const migrations = await query(`SELECT version FROM schema_migrations`);
    write('migrations.json', migrations);

    const methods = await query(`SELECT identifier, type, abi FROM contract_methods;`);
    write('methods.json', methods);

    const contracts = await query(
        `SELECT smart_contracts.name, compiler_version, optimization, smart_contracts.contract_source_code, abi,
                address_hash, constructor_arguments, optimization_runs, evm_version, external_libraries,
                verified_via_sourcify, is_vyper_contract, partially_verified, file_path, is_changed_bytecode,
                bytecode_checked_at, contract_code_md5, implementation_name,

                /* address_names */
                address_names.primary, metadata,

                /* addresses */
                contract_code, verified, decompiled,

                /* smart_contracts_additional_sources */
                file_name, smart_contracts_additional_sources.contract_source_code AS additional_source,

                /* contract_verification_status */
                uid, status,

                /* decompiled_smart_contracts */
                decompiler_version, decompiled_source_code

         FROM smart_contracts
         LEFT JOIN addresses ON (hash = address_hash)
         LEFT JOIN address_names USING(address_hash)
         LEFT JOIN smart_contracts_additional_sources USING(address_hash)
         LEFT JOIN contract_verification_status USING(address_hash)
         LEFT JOIN decompiled_smart_contracts USING(address_hash);`
    );
    for (const contract of contracts) {
        write('contracts/' + contract.name, contract);
    }

    console.log(`successfully exported ${contracts.length} contracts with ${methods.length} methods`);
    await client.end();
})();
