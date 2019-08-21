pragma solidity ^0.5.0;

import "./IERC20.sol";
import "./SafeMath.sol";
import "./SMT.sol";

/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 * For a generic mechanism see {ERC20Mintable}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * We have followed general OpenZeppelin guidelines: functions revert instead
 * of returning `false` on failure. This behavior is nonetheless conventional
 * and does not conflict with the expectations of ERC20 applications.
 *
 * Additionally, an {Approval} event is emitted on calls to {transferFrom}.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 *
 * Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
 * functions have been added to mitigate the well-known issues around setting
 * allowances. See {IERC20-approve}.
 */
contract ERC20 is IERC20 {
    using SafeMath for uint256;
    using SMT for SMT.Data;

    SMT.Data public balances;
    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;

    bytes private zeroProof = hex"0000000000000000000000000000000000000000";

    event Write(address indexed _address, bytes32 indexed _value);

    constructor(uint256 _initialSupply) public {
        // defaultHash[0] is being set to keccak256(uint256(0));
        //balances instead of mapping (address => uint256) _balances;
        balances.DEPTH = 160;
        balances.defaultHashes[0] = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;
        for (uint8 i = 1; i <= balances.DEPTH; i ++) {
            balances.defaultHashes[i] = keccak256(abi.encodePacked(balances.defaultHashes[i-1], balances.defaultHashes[i-1]));
        }
        balances.root = balances.defaultHashes[balances.DEPTH];

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
      require(balance != 18569430475105882587588266137607568536673111973893317399460219858819262702947, "SMT: The balance value you entered equals 0, use 0 instead.");
        if (balance != 0) {
          return balances.read(uint160(account), bytes32(balance), proof);
        } else {
          return balances.read(uint160(account), balances.defaultHashes[0], proof);
        }
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
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20};
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `value`.
     * - the caller must have allowance for `sender`'s tokens of at least
     * `amount`.
     */

    function transferFrom(address sender, uint256 sender_balance, bytes memory sender_proof, address recipient, uint256 recipient_balance, bytes memory recipient_proof, uint256 amount) public returns (bool) {
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        _transfer(sender, sender_balance, sender_proof, recipient, recipient_balance, recipient_proof, amount);
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
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
        require(sender_balance != 0 && sender_balance != 18569430475105882587588266137607568536673111973893317399460219858819262702947, "ERC20: Sender balance is 0");
        require(amount <= sender_balance, "ERC20: transfer amount exceeds balance");
        uint256 c = recipient_balance + amount;
        uint256 d = sender_balance - amount;
        require(c >= recipient_balance, "SafeMath: addition overflow");
        require(c != 18569430475105882587588266137607568536673111973893317399460219858819262702947 && d != 18569430475105882587588266137607568536673111973893317399460219858819262702947, "SMT: Please minimum change the amount."); //SMT restriction, because the zero leaf is defaultHashes[0]

        if (recipient_balance != 0) {
          balances.write(uint160(sender), bytes32(sender_balance), sender_proof, bytes32(sender_balance - amount));
          balances.write(uint160(recipient), bytes32(recipient_balance), recipient_proof, bytes32(recipient_balance + amount));
        } else {
          balances.write(uint160(sender), bytes32(sender_balance), sender_proof, bytes32(sender_balance - amount));
          balances.write(uint160(recipient), balances.defaultHashes[0], recipient_proof, bytes32(recipient_balance + amount));
        }
        emit Write(sender, bytes32(sender_balance - amount));
        emit Write(recipient, bytes32(recipient_balance + amount));



        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements
     *
     * - this implementation for one time mint, use inside constructor. To mint more times - use function above
     * - `to` cannot be the zero address.
     */
    function _mint_initial(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        require(amount != 18569430475105882587588266137607568536673111973893317399460219858819262702947 && amount != 0, "SMT: Minimum change the amount");

        _totalSupply = _totalSupply.add(amount);
        //add requires about overflow

        balances.write(uint160(account), balances.defaultHashes[0], zeroProof, bytes32(amount));
        emit Write(account, bytes32(amount));

        emit Transfer(address(0), account, amount);
    }

    function _mint_repeatedly(address account, uint256 account_balance, bytes memory account_proof, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        require(account_balance + amount != 18569430475105882587588266137607568536673111973893317399460219858819262702947 && amount != 0, "SMT: Minimum change the amount");
        //add requires about overflow
        _totalSupply = _totalSupply.add(amount);

        if (account_balance != 0) {
          balances.write(uint160(account), bytes32(account_balance), account_proof, bytes32(account_balance + amount));
        } else {
          balances.write(uint160(account), balances.defaultHashes[0], account_proof, bytes32(account_balance + amount));
        }

        emit Write(account, bytes32(account_balance + amount));

        emit Transfer(address(0), account, amount);
    }

     /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 account_balance, bytes memory account_proof, uint256 value) internal {
        require(account != address(0), "ERC20: burn from the zero address");
        require(account_balance - value != 18569430475105882587588266137607568536673111973893317399460219858819262702947 && value != 0, "Minimum change the value to burn");
        require(account_balance != 18569430475105882587588266137607568536673111973893317399460219858819262702947 && account_balance != 0, "Account balance is 0");

        //add requires about overflow

        balances.write(uint160(account), bytes32(account_balance), account_proof, bytes32(account_balance - value));
        emit Write(account, bytes32(account_balance - value));
        _totalSupply = _totalSupply.sub(value);
        emit Transfer(account, address(0), value);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /**
     * @dev Destroys `amount` tokens from `account`.`amount` is then deducted
     * from the caller's allowance.
     *
     * See {_burn} and {_approve}.
     */
    function _burnFrom(address account, uint256 account_balance, bytes memory account_proof, uint256 amount) internal {
        _approve(account, msg.sender, _allowances[account][msg.sender].sub(amount, "ERC20: burn amount exceeds allowance"));
        _burn(account, account_balance, account_proof, amount);
    }
}
