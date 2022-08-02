## Description

The contract implements an marketplace that allows users to sell and buy non-fungible tokens (NFTs) which are compliant
with the ERC-721 standard. The marketplace exposes the following functionality to its users:

-   List an NFT.
-   Delist an NFT.
-   Buy an NFT with transferring ownership.
-   Update listing data.
-   Get listing data.

## Installation

```bash
# install application dependencies
$ npm install

# create .env file with the default configuration
$ cp -vi .env.example .env
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
# compile contracts
$ npm run compile
```

## Deploy

```bash
# deploy contracts to the hardhat network
$ npm run deploy:hardhat

# deploy contracts to the local network
$ npm run node
$ npm run deploy:localhost
```
