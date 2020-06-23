pragma solidity ^0.6.10;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";


/**
 * @title ERC827 interface, an extension of IERC20 token standard
 *
 * @dev Interface of a ERC827 token, following the IERC20 standard with extra
 * methods to transfer value and data and execute calls in transfers and
 * approvals.
 */
// solhint-disable-next-line indent
abstract contract ERC827 is IERC20 {

    function approveAndCall(address _spender, uint256 _value, bytes memory _data) public payable virtual returns(bool);

    function transferAndCall(address _to, uint256 _value, bytes memory _data) public payable virtual returns(bool);

    function transferFromAndCall(address _from, address _to, uint256 _value, bytes memory _data)
    public
    payable
    virtual
    returns(bool);
}
