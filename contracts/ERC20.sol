pragma solidity ^0.5.0;

import "./IERC20.sol";
import "./SafeMath.sol";
import "./SMT.sol";

/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is based on storing data with sparse merkle tree data structure. It is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint_initial and _mint_repeatedly}.
 * It is recommended to add _mint_initial in a constructor.
 *
 * We have followed general OpenZeppelin guidelines: functions revert instead
 * of returning `false` on failure. This behavior is nonetheless conventional
 * and does not conflict with the expectations of ERC20 applications.
 *
 */
contract ERC20 is IERC20 {
    using SafeMath for uint256;
    //smt root instead of mapping (address => uint256) _balances;
    bytes32 public root;

    uint256 private _totalSupply;

    bytes private zeroProof = hex"0000000000000000000000000000000000000000";

    event Write(address indexed _address, bytes32 indexed _value);

    constructor(uint256 _initialSupply) public {
        _mint_initial(msg.sender, _initialSupply);
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account, uint256 balance, bytes memory proof) public view returns (bool) {
      return SMT.read(root, uint160(account), bytes32(balance), proof);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(uint256 sender_balance, bytes memory sender_proof, address recipient, uint256 recipient_balance, bytes memory recipient_proof, uint256 amount) public returns (bool) {
        _transfer(msg.sender, sender_balance, sender_proof, recipient, recipient_balance, recipient_proof, amount);
        return true;
    }


    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer and Write} events.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, uint256 sender_balance, bytes memory sender_proof, address recipient, uint256 recipient_balance, bytes memory recipient_proof, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(balanceOf(sender, sender_balance, sender_proof), "SMT: Sender balance or proof is incorrect");
        require(sender_balance != 0, "ERC20: Sender balance is 0");
        require(amount <= sender_balance, "ERC20: transfer amount exceeds balance");
        uint256 c = recipient_balance + amount;
        require(c >= recipient_balance, "SafeMath: addition overflow");

        root = SMT.write(root, uint160(sender), bytes32(sender_balance), sender_proof, bytes32(sender_balance - amount));
        root = SMT.write(root, uint160(recipient), bytes32(recipient_balance), recipient_proof, bytes32(recipient_balance + amount));

        emit Write(sender, bytes32(sender_balance - amount));
        emit Write(recipient, bytes32(recipient_balance + amount));



        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer and Write} events with `from` set to the zero address.
     *
     * Requirements
     *
     * - this implementation for one time mint, use inside constructor. To mint more times - use function above
     * - `to` cannot be the zero address.
     */
    function _mint_initial(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        require(amount != 0, "ERC20: mint 0 tokens");

        _totalSupply = _totalSupply.add(amount);

        root = SMT.write(root, uint160(account), bytes32(0), zeroProof, bytes32(amount));
        emit Write(account, bytes32(amount));

        emit Transfer(address(0), account, amount);
    }

    function _mint_repeatedly(address account, uint256 account_balance, bytes memory account_proof, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        require(amount != 0, "ERC20: mint 0 tokens");

        _totalSupply = _totalSupply.add(amount);

        root = SMT.write(root, uint160(account), bytes32(account_balance), account_proof, bytes32(account_balance + amount));


        emit Write(account, bytes32(account_balance + amount));

        emit Transfer(address(0), account, amount);
    }

     /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer and Write} events with `to` set to the zero address.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 account_balance, bytes memory account_proof, uint256 value) internal {
        require(account != address(0), "ERC20: burn from the zero address");
        require(value != 0, "ERC20: burn 0 tokens");
        require(account_balance != 0, "Account balance is 0");
        require(value <= account_balance, "Account have not enough funds to burn");

        root = SMT.write(root, uint160(account), bytes32(account_balance), account_proof, bytes32(account_balance - value));
        emit Write(account, bytes32(account_balance - value));
        _totalSupply = _totalSupply.sub(value);
        emit Transfer(account, address(0), value);
    }

}
