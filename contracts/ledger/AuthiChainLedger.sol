// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * AuthiChainLedger
 *
 * Off-chain Stripe money movement (checkout sessions, renewal invoices,
 * refunds) anchored on-chain. Deliberately separate from AuthiChainNFT: no
 * shared storage, no shared ABI, no shared recorder role — this contract
 * exists purely to give every sale a public, tamper-evident anchor.
 *
 * stripeRef is a one-way keccak256 commitment to a Stripe object id, never
 * the id itself, so nothing PII-bearing ever lands on-chain.
 */
contract AuthiChainLedger {
    struct Sale {
        bytes32 stripeRef;
        bytes32 sku;
        uint256 amountCents;
        uint8 currency;
        address buyer;
        uint8 source;
        uint256 stripeCreated;
        uint256 anchoredAt;
        bool reversed;
    }

    struct SaleInput {
        bytes32 stripeRef;
        bytes32 sku;
        uint256 amountCents;
        uint8 currency;
        address buyer;
        uint8 source;
        uint256 stripeCreated;
    }

    address public owner;
    mapping(address => bool) public isRecorder;
    mapping(bytes32 => uint256) public saleIdByRef;
    mapping(uint256 => Sale) private _sales;
    uint256 public totalSales;

    event SaleRecorded(
        uint256 indexed saleId,
        bytes32 indexed stripeRef,
        bytes32 indexed sku,
        uint256 amountCents,
        uint8 source
    );
    event SaleReversed(uint256 indexed saleId, bytes32 indexed stripeRef);
    event DuplicateSaleIgnored(uint256 indexed saleId, bytes32 indexed stripeRef);
    event RecorderUpdated(address indexed account, bool allowed);

    error NotOwner();
    error NotRecorder();
    error UnknownSale();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRecorder() {
        if (!isRecorder[msg.sender]) revert NotRecorder();
        _;
    }

    constructor(address initialOwner) {
        owner = initialOwner;
        isRecorder[initialOwner] = true;
        emit RecorderUpdated(initialOwner, true);
    }

    /// @notice Grants or revokes write access. Owner-only.
    function setRecorder(address account, bool allowed) external onlyOwner {
        isRecorder[account] = allowed;
        emit RecorderUpdated(account, allowed);
    }

    /// @notice Anchors a single sale. Replays of an already-anchored
    /// stripeRef are a no-op that returns the existing saleId.
    function recordSale(
        bytes32 stripeRef,
        bytes32 sku,
        uint256 amountCents,
        uint8 currency,
        address buyer,
        uint8 source,
        uint256 stripeCreated
    ) external onlyRecorder returns (uint256) {
        return _recordSale(stripeRef, sku, amountCents, currency, buyer, source, stripeCreated);
    }

    /// @notice Batch form of recordSale, used by the backfill script. Each
    /// input is resolved independently — a ref already anchored (live or a
    /// prior backfill pass) is skipped, never overwritten.
    function recordSaleBatch(SaleInput[] calldata inputs) external onlyRecorder returns (uint256[] memory ids) {
        ids = new uint256[](inputs.length);
        for (uint256 i = 0; i < inputs.length; i++) {
            SaleInput calldata inp = inputs[i];
            ids[i] = _recordSale(
                inp.stripeRef,
                inp.sku,
                inp.amountCents,
                inp.currency,
                inp.buyer,
                inp.source,
                inp.stripeCreated
            );
        }
    }

    /// @notice Marks a previously anchored sale reversed (refund/void).
    /// Idempotent; reverts only if the ref was never anchored.
    function recordReversal(bytes32 stripeRef) external onlyRecorder {
        uint256 saleId = saleIdByRef[stripeRef];
        if (saleId == 0) revert UnknownSale();

        if (_sales[saleId].reversed) return;

        _sales[saleId].reversed = true;
        emit SaleReversed(saleId, stripeRef);
    }

    function saleByStripeRef(bytes32 stripeRef) external view returns (Sale memory) {
        return _sales[saleIdByRef[stripeRef]];
    }

    function isAnchored(bytes32 stripeRef) external view returns (bool) {
        return saleIdByRef[stripeRef] != 0;
    }

    function _recordSale(
        bytes32 stripeRef,
        bytes32 sku,
        uint256 amountCents,
        uint8 currency,
        address buyer,
        uint8 source,
        uint256 stripeCreated
    ) private returns (uint256) {
        uint256 existing = saleIdByRef[stripeRef];
        if (existing != 0) {
            emit DuplicateSaleIgnored(existing, stripeRef);
            return existing;
        }

        uint256 saleId = ++totalSales;

        _sales[saleId] = Sale({
            stripeRef: stripeRef,
            sku: sku,
            amountCents: amountCents,
            currency: currency,
            buyer: buyer,
            source: source,
            stripeCreated: stripeCreated,
            anchoredAt: block.timestamp,
            reversed: false
        });
        saleIdByRef[stripeRef] = saleId;

        emit SaleRecorded(saleId, stripeRef, sku, amountCents, source);
        return saleId;
    }
}
