import { HardhatUserConfig } from "hardhat/config";
import Joi from "joi";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "./plugins/env-vars";

const schema = Joi.object()
    .keys({
        ALCHEMY_API_KEY: Joi.string()
            .required()
            .regex(/^[0-9A-Za-z_-]{32}$/)
            .description("The API key of the Alchemy provider"),
        ETHERSCAN_API_KEY: Joi.string()
            .required()
            .length(34)
            .alphanum()
            .description("The API key of the Etherscan explorer"),
        POLYGONSCAN_API_KEY: Joi.string()
            .required()
            .length(34)
            .alphanum()
            .description("The API key of the Polygon explorer"),
        TESTNET_SENDER_MNEMONIC: Joi.string()
            .required()
            .regex(/^[a-z ]+/)
            .description("The sender's mnemonic for the Goerli network"),
        TESTNET_SENDER_PASSPHRASE: Joi.string()
            .optional()
            .allow("")
            .description("The sender's passphrase for the Goerli network"),
        TESTNET_SENDER_ADDRESS: Joi.string()
            .required()
            .regex(/^0x[0-9A-Fa-f]{40}$/)
            .alphanum()
            .description("The sender's address for the Goerli network"),
        REPORT_GAS: Joi.string()
            .optional()
            .valid("true", "false")
            .default("false")
            .description("Report gas usage in tests"),
    })
    .unknown();

const { value: envVars, error } = schema
    .prefs({
        errors: {
            label: "key",
        },
    })
    .validate(process.env);
if (error) {
    throw new Error(error.details[0]?.message);
}

const testnetHDAccounts = {
    mnemonic: envVars.TESTNET_SENDER_MNEMONIC,
    passphrase: envVars.TESTNET_SENDER_PASSPHRASE,
    initialIndex: 0,
    count: 10,
};

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            forking: {
                url: `https://eth-mainnet.alchemyapi.io/v2/${envVars.ALCHEMY_API_KEY}`,
                blockNumber: 15319400,
            },
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 1337,
        },
        ethereumGoerli: {
            url: `https://eth-goerli.alchemyapi.io/v2/${envVars.ALCHEMY_API_KEY}`,
            chainId: 5,
            from: envVars.TESTNET_SENDER_ADDRESS,
            accounts: testnetHDAccounts,
        },
        polygonMumbai: {
            url: `https://polygon-mumbai.g.alchemy.com/v2/${envVars.ALCHEMY_API_KEY}`,
            chainId: 80001,
            from: envVars.TESTNET_SENDER_ADDRESS,
            accounts: testnetHDAccounts,
        },
        optimismGoerli: {
            url: `https://opt-goerli.g.alchemy.com/v2/${envVars.ALCHEMY_API_KEY}`,
            chainId: 420,
            from: envVars.TESTNET_SENDER_ADDRESS,
            accounts: testnetHDAccounts,
        },
    },
    etherscan: {
        apiKey: {
            ethereumGoerli: envVars.ETHERSCAN_API_KEY,
            polygonMumbai: envVars.POLYGONSCAN_API_KEY,
        },
        customChains: [
            {
                network: "ethereumGoerli",
                chainId: 5,
                urls: {
                    apiURL: "https://api-goerli.etherscan.io/api",
                    browserURL: "https://goerli.etherscan.io",
                },
            },
            {
                network: "polygonMumbai",
                chainId: 80001,
                urls: {
                    apiURL: "https://api-testnet.polygonscan.com/api",
                    browserURL: "https://mumbai.polygonscan.com",
                },
            },
        ],
    },
    gasReporter: {
        enabled: envVars.REPORT_GAS === "true",
        excludeContracts: [
            "ERC20",
            "ERC721",
            "EscrowUpgradeable",
            "TestMarketplace",
            "TestMarketplaceV2",
            "TestERC20",
            "TestERC721",
        ],
    },
    solidity: {
        version: "0.8.9",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        artifacts: "./artifacts",
        cache: "./cache",
    },
    mocha: {
        timeout: 40000,
    },
};

export default config;
