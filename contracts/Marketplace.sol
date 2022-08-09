// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { PullPaymentUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PullPaymentUpgradeable.sol";
import { CountersUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

error NFTNotApproved(IERC721 tokenContract, uint256 tokenId);
error InvalidNFTOwner(address spender);
error PurchaseForbidden(address buyer);
error WithdrawalForbidden(address payee);
error WithdrawalLocked(address payee, uint256 currentTimestamp, uint256 unlockTimestamp);
error TokenAlreadyListed(IERC721 tokenContract, uint256 tokenId);
error TokenNotListed(IERC721 tokenContract, uint256 tokenId);
error InvalidListingFee(IERC721 tokenContract, uint256 tokenId, uint256 fee);
error InvalidListingPrice(IERC721 tokenContract, uint256 tokenId, uint256 price);
error ZeroPrice();

/**
 * @dev This contract implements a marketplace that allows users to sell and buy non-fungible tokens (NFTs) which are
 * compliant with the ERC-721 standard. In particular the marketplace exposes the following functionality to its users:
 * - List an NFT.
 * - Delist an NFT.
 * - Buy an NFT with transferring ownership.
 * - Update listing data.
 * - Get listing data.
 *
 * All the opertions above identify an NFT by the address of its NTF contract and the identifier assigned within this NTF
 * contract. Note the marketplace doesn't assume NFT's ownership when the NFT is listed there. So it's a responsibility
 * of the NFT owner to guarantee that the marketplace is approved to manage the NFT in advance. The approval is achieved
 * by calling the approve method on the NFT contract with the marketplace's address and the given NFT.
 *
 * From the administrative perspective the contract is controlled by the single owner account. The owner is capable of
 * executing the following functionality:
 * - Pause/unpause invocation of certain methods on the contract in case of emergency.
 * - Transfer/Renounce the contract's ownership.
 * - Set the listing fee and the withdrawal period.
 *
 * The contract is upgradeable by sticking to the proxy upgrade pattern based on the unstructured storage and
 * transparent proxies approach. For more information about all these concepts, see
 * https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies.
 *
 * The marketplace implements a pull payment strategy, where the NFT seller account doesn't receive its owed payments
 * directly from the marketplace, but has to withdraw them on its own instead. For more detail on this strategy, see
 * https://consensys.github.io/smart-contract-best-practices/development-recommendations/general/external-calls/#favor-pull-over-push-for-external-calls
 *
 * Note that payments cannot be withdrawn immediately. The seller have to wait for a certain withdrawal period starting
 * from the moment they carried out their last trade.
 *
 * Some methods are made reentrancy resistant due to the fact that their implementation is unable to be fully compliant
 * with the checks-effects-interractions pattern due to forced external calls in modifiers. For more detail on
 * reentrancy attacks, see https://consensys.github.io/smart-contract-best-practices/attacks/reentrancy/.
 */
contract Marketplace is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    PullPaymentUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /**
     * @dev Emitted when the `seller` account lists the NFT at the marketplace.
     */
    event TokenListed(
        address indexed seller,
        IERC721 indexed tokenContract,
        uint256 indexed tokenId,
        uint256 price
    );

    /**
     * @dev Emitted when the `seller` account delists the NFT from the marketplace.
     */
    event TokenDelisted(
        address indexed seller,
        IERC721 indexed tokenContract,
        uint256 indexed tokenId
    );

    /**
     * @dev Emitted when the `buyer` account purchases the NFT listed at the marketplace.
     */
    event TokenBought(
        address indexed buyer,
        IERC721 indexed tokenContract,
        uint256 indexed tokenId,
        uint256 price
    );

    /**
     * @dev Emitted when the `payee` account withdraws accumulated payments.
     */
    event PaymentsWithdrawn(address indexed payee, uint256 amount);

    /**
     * @dev Emitted when the owner sets the given listing fee.
     */
    event ListingFeeSet(uint256 listingFee);

    /**
     * @dev Emitted when the owner sets the given withdrawal period.
     */
    event WithdrawalPeriodSet(uint256 withdrawalPeriod);

    struct Listing {
        address seller;
        uint256 price;
    }

    /**
     * @dev The current listing fee. It can be changed through the `setListingFee` method.
     */
    uint256 public listingFee;

    /**
     * @dev The current withdrawal period. It can be changed through the `setWithdrawalPeriod` method.
     */
    uint256 public withdrawalPeriod;

    /**
     * @dev The total listing count at the marketplace.
     */
    CountersUpgradeable.Counter public listingCount;

    /**
     * @dev The mapping between accounts who sold an NFT and release dates of locked payments.
     */
    mapping(address => uint256) public paymentDates;

    /**
     * @dev The mapping between an NFT (identitifed as the NFT address + NFT id) and a listing at the marketplace.
     */
    mapping(IERC721 => mapping(uint256 => Listing)) private _tokenToListing;

    /**
     * @dev Throws if called by any account other than the NFT owner.
     */
    modifier isNFTOwner(
        IERC721 tokenContract,
        uint256 tokenId,
        address spender
    ) {
        if (tokenContract.ownerOf(tokenId) != spender) {
            revert InvalidNFTOwner(spender);
        }
        _;
    }

    /**
     * @dev Throws if the NFT is not listed at the marketplace.
     */
    modifier isListed(IERC721 tokenContract, uint256 tokenId) {
        Listing memory listing = _tokenToListing[tokenContract][tokenId];
        if (listing.price == 0) {
            revert TokenNotListed(tokenContract, tokenId);
        }
        _;
    }

    /**
     * @dev Throws if the NFT is not approved by the owner account.
     */
    modifier isApproved(IERC721 tokenContract, uint256 tokenId) {
        if (tokenContract.getApproved(tokenId) != address(this)) {
            revert NFTNotApproved(tokenContract, tokenId);
        }
        _;
    }

    /**
     * See https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#initializing_the_implementation_contract
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract setting the `listingFee` fee and the `withdrawalPeriod` period.
     * See https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#initializers
     */
    function initialize(uint256 listingFee_, uint256 withdrawalPeriod_) public initializer {
        OwnableUpgradeable.__Ownable_init();
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        PullPaymentUpgradeable.__PullPayment_init();

        listingFee = listingFee_;
        withdrawalPeriod = withdrawalPeriod_;
    }

    /**
     * @dev Lists the NFT at the marketplace with the given `price`.
     *
     * Requirements:
     *
     * - The caller must be the owner of the NFT.
     *
     * - Before calling this method, the caller must approve thie contract to manage the NFT by calling the `approve`
     *   method on the corresponding NFT contract.
     *
     * - While calling this method, the caller must specify the value equal to the marketplace's listing fee, which can
     *   be retieved with the `listingFee` getter.
     *
     * - The listing `price` can be anything starting from 1 Wei.
     *
     * @param tokenContract The address of the NFT contract.
     * @param tokenId The id of the NFT in the `tokenContract` contract.
     * @param price The desired price to sell the NFT at the marketplace.
     *
     * Emits a {TokenListed} event.
     */
    function listToken(
        IERC721 tokenContract,
        uint256 tokenId,
        uint256 price
    )
        external
        payable
        nonReentrant
        isNFTOwner(tokenContract, tokenId, msg.sender)
        isApproved(tokenContract, tokenId)
    {
        if (price == 0) {
            revert ZeroPrice();
        }

        if (msg.value != listingFee) {
            revert InvalidListingFee(tokenContract, tokenId, msg.value);
        }

        if (_tokenToListing[tokenContract][tokenId].price > 0) {
            revert TokenAlreadyListed(tokenContract, tokenId);
        }

        _tokenToListing[tokenContract][tokenId] = Listing({ seller: msg.sender, price: price });
        listingCount.increment();

        address owner = super.owner();
        paymentDates[owner] = block.timestamp;

        super._asyncTransfer(owner, msg.value);

        emit TokenListed(msg.sender, tokenContract, tokenId, price);
    }

    /**
     * @dev Delists the NFT from the marketplace.
     *
     * Note that the information about the delisted NFT is wiped out completely from the marketplace contract.
     *
     * Requirements:
     *
     * - The NFT must be listed at the marketplace.
     *
     * - The caller must approve this contract to operate the NFT by calling the `approve` method on the corresponding
     *   NFT contract.
     *
     * - The caller must be the owner of the NFT.
     *
     * @param tokenContract The address of the NFT contract.
     * @param tokenId The id of the NFT in the `tokenContract` contract.
     *
     * Emits a {TokenDelisted} event.
     */
    function delistToken(IERC721 tokenContract, uint256 tokenId)
        external
        isListed(tokenContract, tokenId)
        nonReentrant
        isNFTOwner(tokenContract, tokenId, msg.sender)
    {
        delete _tokenToListing[tokenContract][tokenId];
        listingCount.decrement();

        emit TokenDelisted(msg.sender, tokenContract, tokenId);
    }

    /**
     * @dev Buys the NFT through the marketplace. The seller receives a payment from the buyer accumulated at the escrow
     * and locked for the contract's withdrawal period.
     *
     * Note that the information about the bought NFT is wiped out completely from the marketplace contract.
     *
     * Requirements:
     *
     * - The NFT must be listed at the marketplace.
     *
     * - The caller must approve this contract to operate the NFT by calling the `approve` method on the corresponding
     *   NFT contract.
     *
     * - The caller must be the owner of the NFT.
     *
     * - The caller must transfer the value matching the NTF listed price.
     *
     * @param tokenContract The address of the NFT contract.
     * @param tokenId The id of the NFT in the `tokenContract` contract.
     *
     * Emits a {TokenBought} event.
     */
    function buyToken(IERC721 tokenContract, uint256 tokenId)
        external
        payable
        whenNotPaused
        isListed(tokenContract, tokenId)
        nonReentrant
        isApproved(tokenContract, tokenId)
    {
        Listing memory listing = _tokenToListing[tokenContract][tokenId];
        if (listing.price != msg.value) {
            revert InvalidListingPrice(tokenContract, tokenId, msg.value);
        }

        if (tokenContract.ownerOf(tokenId) == msg.sender) {
            revert PurchaseForbidden(msg.sender);
        }

        delete _tokenToListing[tokenContract][tokenId];
        listingCount.decrement();
        paymentDates[listing.seller] = block.timestamp + withdrawalPeriod;

        super._asyncTransfer(listing.seller, msg.value);

        tokenContract.safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit TokenBought(msg.sender, tokenContract, tokenId, listing.price);
    }

    /**
     * @dev Updates the price of the listed NFT.
     *
     * Note the the caller is not prevented from setting the same price again.
     *
     * Requirements:
     *
     * - The NFT must be listed at the marketplace.
     *
     * - The caller must be the owner of the NFT.
     *
     * - The listing `newPrice` price can be anything starting from 1 Wei.
     *
     * @param tokenContract The address of the NFT contract.
     * @param tokenId The id of the NFT in the `tokenContract` contract.
     *
     * Emits a {TokenListed} event.
     */
    function updateListing(
        IERC721 tokenContract,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        isListed(tokenContract, tokenId)
        nonReentrant
        isNFTOwner(tokenContract, tokenId, msg.sender)
    {
        if (newPrice == 0) {
            revert ZeroPrice();
        }

        _tokenToListing[tokenContract][tokenId].price = newPrice;
        emit TokenListed(msg.sender, tokenContract, tokenId, newPrice);
    }

    /**
     * @dev Withdraws accumulated payments for the payee account.
     *
     * Requirements:
     *
     * - The caller must be either the `payee` or the owner account.
     *
     * - The withdrawal period must end up.
     *
     * @param payee The address of the `payee` account.
     *
     * Emits a {PaymentsWithdrawn} event.
     */
    function withdrawPayments(address payable payee) public override whenNotPaused {
        if (msg.sender != payee && msg.sender != super.owner()) {
            revert WithdrawalForbidden(payee);
        }

        if (block.timestamp <= paymentDates[payee]) {
            revert WithdrawalLocked(payee, block.timestamp, paymentDates[payee]);
        }

        delete paymentDates[payee];
        uint256 amount = super.payments(payee);

        super.withdrawPayments(payee);

        emit PaymentsWithdrawn(payee, amount);
    }

    /**
     * @dev Sets the listing fee of the marketplace. The fee is expressed in Wei and can be anything starting from zero.
     *
     * It is an adminstrative method that can be called by the owner only.
     *
     * Note the caller is not prevented from setting the same listing fee again.
     *
     * @param listingFee_ The listing fee of the marketplace.
     *
     * Emits a {ListingFeeSet} event.
     */
    function setListingFee(uint256 listingFee_) external onlyOwner {
        listingFee = listingFee_;
        emit ListingFeeSet(listingFee_);
    }

    /**
     * @dev Sets the withdrawal period for pending payments. The period is expressed in seconds and can be anything
     * starting from zero.
     *
     * It is an adminstrative method that can be called by the owner only.
     *
     * Note the caller is not prevented from setting the same withdrawal period again.
     *
     * @param withdrawalPeriod_ The withdrawal period for pending payments (in seconds).
     *
     * Emits a {WithdrawalPeriodSet} event.
     */
    function setWithdrawalPeriod(uint256 withdrawalPeriod_) external onlyOwner {
        withdrawalPeriod = withdrawalPeriod_;
        emit WithdrawalPeriodSet(withdrawalPeriod_);
    }

    /**
     * @dev Performs an emergency stop on the contract for the `buyToken` and `withdrawPayments` methods.
     *
     * It is an adminstrative method that can be called by the owner only.
     */
    function pause() external onlyOwner {
        super._pause();
    }

    /**
     * @dev Releases an emergency stop on the contract for the `buyToken` and `withdrawPayments` methods.
     *
     * It is an adminstrative method that can be called by the owner only.
     */
    function unpause() external onlyOwner {
        super._unpause();
    }

    /**
     * @dev Returns the information about the listed NFT, if any.
     */
    function getListing(IERC721 tokenContract, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return _tokenToListing[tokenContract][tokenId];
    }
}
