## Description

The contract implements an marketplace that allows users to sell and buy non-fungible tokens (NFTs) which are compliant
with the ERC-721 standard. The marketplace exposes the following functionality to its users:

-   List an NFT.
-   Delist an NFT.
-   Buy an NFT with transferring ownership.
-   Update listing data.
-   Get listing data.

## Sample contract addresses

-   Marketplace: https://goerli.etherscan.io/address/0x05435866Ccc7c76f1d9400Ab470d644CACC538F3
-   TransparentUpgradeableProxy: https://goerli.etherscan.io/address/0xd3cf8ffb1a65ed3ab6586679fa31be34fe902d98
-   ProxyAdmin: https://goerli.etherscan.io/address/0x3cd80e6aeb7b90f442fd7c1a6e01f2ab040f65e1

## Installation

```bash
# install application dependencies
$ npm install
```

## Preparation

```bash
# create the .env file with the default configuration
$ cp -vi .env.example .env

# initialize the empty variables in the .env file with the corresponding values
$ sed -r -i 's/^(ALCHEMY_API_KEY=)/\1<YOUR_ALCHEMY_API_KEY>/' .env
$ sed -r -i 's/^(GOERLI_PRIVATE_KEY=)/\1<YOUR_GOERLI_PRIVATE_KEY>/' .env
$ sed -r -i 's/^(ETHERSCAN_API_KEY=)/\1<YOUR_ETHERSCAN_API_KEY>/' .env
```

## Format & Lint

```bash
# format the code
$ npm run format

# lint the code
$ npm run lint
```

## Test

```bash
# run unit tests
$ npm run test

# run test coverage
$ npm run coverage
```

## Compile

```bash
# compile the contracts
$ npm run compile
```

## Deploy

```bash
# deploy the contracts to the hardhat network
$ npm run deploy:hardhat

# deploy the contracts to the localhost network
$ npm run node
$ npm run deploy:localhost

# deploy the contracts to the goerli network
$ npm run deploy:goerli
```

## Verify

```bash
# verify the marketplace contract in the goerli network
$ sed -r -i 's/^(MARKETPLACE_ADDRESS=)/\1<YOUR_MARKETPLACE_ADDRESS>/' .env
$ npm run deploy:goerli
```
