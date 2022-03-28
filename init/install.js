
const fs = require('fs')
const ethers = require('ethers')

const { Client } = require('pg')
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'blockscout',
    port: 7432,
})

console.log("Updating Postgres tables for L2 Arbitrum");

(async () => {
    await client.connect()

    const install = async (address, name, version) => {
        console.log("Installing", name, 'at', address);
        let abi = JSON.parse(fs.readFileSync('data/' + name + '.abi'));
        let desc = fs.readFileSync('data/' + name + '.txt').toString().replaceAll('\n', '\n\r');

        await client.query(
            `INSERT INTO addresses (hash, contract_code, verified, inserted_at, updated_at)
             VALUES ($1, 'ArbOS', true, now(), now())
             ON CONFLICT DO NOTHING`,
            [Buffer.from(address, 'hex')],
        );
        
        await client.query(
            `INSERT INTO smart_contracts (name, address_hash, compiler_version, abi, contract_source_code, 
             optimization, inserted_at, updated_at, contract_code_md5, is_changed_bytecode)
             VALUES ($1, $2, $3, $4, $5, true, now(), now(), 'No MD5', false)
             ON CONFLICT (address_hash) DO
                 UPDATE SET compiler_version = $3, abi = $4, contract_source_code = $5,
                 updated_at = now(), is_changed_bytecode = false`,
            [name, Buffer.from(address, 'hex'), version, JSON.stringify(abi), desc],
        );

        let contract = new ethers.utils.Interface(abi)
        let selectors = {}

        for (const key of Object.keys(contract.functions)) {
            const identifier = contract.functions[key];
            let selector = parseInt(contract.getSighash(identifier.name), 16) >> 0;
            const method = abi[identifier.name];
            selectors[identifier.name] = selector;
        }

        for (const item of abi) {
            if (item.type == 'function') {
                const selector = selectors[item.name];
                console.log('  => method', selector, item.name);
                await client.query(
                    `INSERT INTO contract_methods (identifier, abi, type, inserted_at, updated_at)
                     VALUES ($1, $2, 'ArbOS', now(), now())
                     ON CONFLICT (identifier, abi) DO UPDATE SET identifier = $1, abi = $2`,
                    [selector, item],
                );
            }
        }

        await client.query(
            `UPDATE smart_contracts SET is_changed_bytecode = false WHERE address_hash = $1`,
            [Buffer.from(address, 'hex')],
        );
    }
    
    await install('00000000000000000000000000000000000a4b05', 'ArbOS', 'EVM Hypervisor (go 1.17)')
    await install('0000000000000000000000000000000000000064', 'ArbSys', 'L2 Precompile (go 1.17)')
    await install('0000000000000000000000000000000000000065', 'ArbInfo', 'L2 Precompile (go 1.17)')
    await install('0000000000000000000000000000000000000066', 'ArbAddressTable', 'L2 Precompile (go 1.17)')
    await install('0000000000000000000000000000000000000067', 'ArbBLS', 'L2 Precompile (go 1.17)')
    await install('0000000000000000000000000000000000000068', 'ArbFunctionTable', 'L2 Precompile (go 1.17)')
    await install('0000000000000000000000000000000000000069', 'ArbosTest', 'L2 Precompile (go 1.17)')
    await install('000000000000000000000000000000000000006b', 'ArbOwnerPublic', 'L2 Precompile (go 1.17)')
    await install('000000000000000000000000000000000000006c', 'ArbGasInfo', 'L2 Precompile (go 1.17)')
    await install('000000000000000000000000000000000000006d', 'ArbAggregator', 'L2 Precompile (go 1.17)')
    await install('000000000000000000000000000000000000006e', 'ArbRetryableTx', 'L2 Precompile (go 1.17)')
    await install('000000000000000000000000000000000000006f', 'ArbStatistics', 'L2 Precompile (go 1.17)')
    await install('0000000000000000000000000000000000000070', 'ArbOwner', 'L2 Precompile (go 1.17)')
    await install('00000000000000000000000000000000000000ff', 'ArbDebug', 'L2 Precompile (go 1.17)')

    await client.end()
})();
