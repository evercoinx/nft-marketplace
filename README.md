## Project Description

The marketplace allows users to trade non-fungible tokens (NFTs) which are compliant with the
ERC-721 standard. The smart contract exposes the following functionality to its users:

-   List an NFT
-   Delist an NFT
-   Buy an NFT with transferring ownership
-   Update listing data
-   Get listing data

## Deployments

### Ethereum Goerli Testnet

-   `Marketplace`: https://goerli.etherscan.io/address/0x05435866Ccc7c76f1d9400Ab470d644CACC538F3
-   `TransparentUpgradeableProxy`: https://goerli.etherscan.io/address/0xd3cf8ffb1a65ed3ab6586679fa31be34fe902d98
-   `ProxyAdmin`: https://goerli.etherscan.io/address/0x3cd80e6aeb7b90f442fd7c1a6e01f2ab040f65e1

### Polygon Mumbai Testnet

-   `Marketplace`: https://mumbai.polygonscan.com/address/0x05435866Ccc7c76f1d9400Ab470d644CACC538F3
-   `TransparentUpgradeableProxy`: https://mumbai.polygonscan.com/address/0xD3cf8fFb1A65ED3ab6586679FA31Be34FE902D98
-   `ProxyAdmin`: https://mumbai.polygonscan.com/address/0x3cd80E6AeB7B90F442fD7C1A6e01f2ab040f65e1

### Optimism Goerli Testnet

-   `Marketplace`: https://blockscout.com/optimism/goerli/address/0x3cd80E6AeB7B90F442fD7C1A6e01f2ab040f65e1
-   `TransparentUpgradeableProxy`: https://blockscout.com/optimism/goerli/address/0xD3cf8fFb1A65ED3ab6586679FA31Be34FE902D98
-   `ProxyAdmin`: https://blockscout.com/optimism/goerli/address/0xEAbb04Ae3C37311929fbF325398374d7414eB51B

## Scripts

### Install

```bash
# install application dependencies
$ npm install
```

### Prepare

```bash
# create the .env file with the default configuration
$ cp -vi .env.example .env

# initialize the empty variables in the .env file with the corresponding values
$ sed -r -i 's/^(ALCHEMY_API_KEY=)/\1<YOUR_ALCHEMY_API_KEY>/' .env
$ sed -r -i 's/^(ETHERSCAN_API_KEY=)/\1<YOUR_ETHERSCAN_API_KEY>/' .env
$ sed -r -i 's/^(TESTNET_SENDER_MNEMONIC=)/\1<YOUR_TESTNET_SENDER_MNEMONIC>/' .env
$ sed -r -i 's/^(TESTNET_SENDER_PASSPHRASE=)/\1<YOUR_TESTNET_SENDER_PASSPHRASE_IF_ANY>/' .env
$ sed -r -i 's/^(TESTNET_SENDER_ADDRESS=)/\1<YOUR_TESTNET_SENDER_ADDRESS>/' .env
```

### Format & Lint

```bash
# format the code
$ npm run format

# lint the code
$ npm run lint
```

### Test

```bash
# run unit tests
$ npm run test

# run unit tests with a coverage report
$ npm run test:cover

# run unit tests with a gas report
$ npm run test:gas
```

### Analyze

```bash
# analyze the contracts with mythril
$ npm run analyze:mythril

# analyze the contracts with slither
$ npm run analyze:slither
```

### Flatten

```bash
# flatten the contracts
$ npm run flatten
```

### Compile

```bash
# compile the contracts
$ npm run compile
```

### Clean

```bash
# clean up the cache and contracts' artificats
$ npm run clean
```

### Node & Console

```bash
# run the local node
$ npm run node

# interract with the running local node
$ npm run console
```

### Deploy

```bash
# deploy the contracts to the hardhat network
$ npm run deploy:hardhat

# deploy the contracts to the localhost network
$ npm run node
$ npm run deploy:localhost

# deploy the contracts to ethereum's goerli network
$ npm run deploy:eth-goerli

# deploy the contracts to polygon's mumbai network
$ npm run deploy:pol-goerli

# deploy the contracts to optimism's goerli network
$ npm run deploy:opt-goerli
```

### Verify

```bash
# set the address of the marketplace contract
$ sed -r -i 's/^(MARKETPLACE_ADDRESS=)/\1<YOUR_MARKETPLACE_ADDRESS>/' .env

# verify the contracts in ethereum's goerli network
$ npm run verify:eth-goerli

# verify the contracts in polygon's mumbai network
$ npm run verify:pol-mumbai
```
