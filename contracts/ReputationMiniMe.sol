pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
//import "openzeppelin-solidity/contracts/ownership/Whitelist.sol";


/**
 * @title Reputation system
 * @dev A DAO has Reputation System which allows peers to rate other peers in order to build trust .
 * A reputation is use to assign influence measure to a DAO'S peers.
 * Reputation is similar to regular tokens but with one crucial difference: It is non-transferable.
 * The Reputation contract maintain a map of address to reputation value.
 * It provides an onlyOwner functions to mint and burn reputation _to (or _from) a specific address.
 */

contract ReputationMiniMe is Ownable {


      uint8 public decimals = 18;             //Number of decimals of the smallest unit
      // Event indicating minting of reputation to an address.
      event Mint(address indexed _to, uint256 _amount);
      // Event indicating burning of reputation for an address.
      event Burn(address indexed _from, uint256 _amount);
      event NewCloneReputaionToken(address indexed _cloneToken, uint _snapshotBlock);



      /// @dev `Checkpoint` is the structure that attaches a block number to a
      ///  given value, the block number attached is the one that last changed the
      ///  value
      struct  Checkpoint {

          // `fromBlock` is the block number that the value was generated from
          uint128 fromBlock;

          // `value` is the amount of tokens at a specific block number
          uint128 value;
      }

      // `parentToken` is the Token address that was cloned to produce this token;
      //  it will be 0x0 for a token that was not cloned
      ReputationMiniMe public parentToken;

      // `parentSnapShotBlock` is the block number from the Parent Token that was
      //  used to determine the initial distribution of the Clone Token
      uint public parentSnapShotBlock;

      // `creationBlock` is the block number that the Clone Token was created
      uint public creationBlock;

      // `balances` is the map that tracks the balance of each address, in this
      //  contract when the balance changes the block number that the change
      //  occurred is also included in the map
      mapping (address => Checkpoint[]) balances;

      // Tracks the history of the `totalSupply` of the token
      Checkpoint[] totalSupplyHistory;

      // The factory used to create new clone tokens
      ReputationMiniMeTokenFactory public tokenFactory;

  ////////////////
  // Constructor
  ////////////////

      /// @notice Constructor to create a MiniMeToken
      /// @param _tokenFactory The address of the MiniMeTokenFactory contract that
      ///  will create the Clone token contracts, the token factory needs to be
      ///  deployed first
      /// @param _parentToken Address of the parent token, set to 0x0 if it is a
      ///  new token
      /// @param _parentSnapShotBlock Block of the parent token that will
      ///  determine the initial distribution of the clone token, set to 0 if it
      ///  is a new token
      constructor(
          address _tokenFactory,
          address _parentToken,
          uint _parentSnapShotBlock
      ) public
      {
          tokenFactory = ReputationMiniMeTokenFactory(_tokenFactory);
          parentToken = ReputationMiniMe(_parentToken);
          parentSnapShotBlock = _parentSnapShotBlock;
          creationBlock = block.number;
          //addAddressToWhitelist(msg.sender);
      }


      /// @dev This function makes it easy to get the total number of tokens
      /// @return The total number of tokens
      function totalSupply() public constant returns (uint) {
          return totalSupplyAt(block.number);
      }


  ////////////////
  // Query balance and totalSupply in History
  ////////////////
    /**
    * @dev return the reputation amount of a given owner
    * @param _owner an address of the owner which we want to get his reputation
    */
    function reputationOf(address _owner) public view returns (uint256 balance) {
        return balanceOfAt(_owner, block.number);
    }

    /**
    * @dev return the reputation amount of a given owner
    * @param _owner an address of the owner which we want to get his reputation
    */
    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balanceOfAt(_owner, block.number);
    }


      /// @dev Queries the balance of `_owner` at a specific `_blockNumber`
      /// @param _owner The address from which the balance will be retrieved
      /// @param _blockNumber The block number when the balance is queried
      /// @return The balance at `_blockNumber`
      function balanceOfAt(address _owner, uint _blockNumber) public constant
          returns (uint) {

          // These next few lines are used when the balance of the token is
          //  requested before a check point was ever created for this token, it
          //  requires that the `parentToken.balanceOfAt` be queried at the
          //  genesis block for that token as this contains initial balance of
          //  this token
          if ((balances[_owner].length == 0)
              || (balances[_owner][0].fromBlock > _blockNumber)) {
              if (address(parentToken) != 0) {
                  return parentToken.balanceOfAt(_owner, min(_blockNumber, parentSnapShotBlock));
              } else {
                  // Has no parent
                  return 0;
              }

          // This will return the expected balance during normal situations
          } else {
              return getValueAt(balances[_owner], _blockNumber);
          }
      }

      /// @notice Total amount of tokens at a specific `_blockNumber`.
      /// @param _blockNumber The block number when the totalSupply is queried
      /// @return The total amount of tokens at `_blockNumber`
      function totalSupplyAt(uint _blockNumber) public constant returns(uint) {

          // These next few lines are used when the totalSupply of the token is
          //  requested before a check point was ever created for this token, it
          //  requires that the `parentToken.totalSupplyAt` be queried at the
          //  genesis block for this token as that contains totalSupply of this
          //  token at this block number.
          if ((totalSupplyHistory.length == 0)
              || (totalSupplyHistory[0].fromBlock > _blockNumber)) {
              if (address(parentToken) != 0) {
                  return parentToken.totalSupplyAt(min(_blockNumber, parentSnapShotBlock));
              } else {
                  return 0;
              }

          // This will return the expected totalSupply during normal situations
          } else {
              return getValueAt(totalSupplyHistory, _blockNumber);
          }
      }

  ////////////////
  // Clone Token Method
  ////////////////

      /// @notice Creates a new clone token with the initial distribution being
      ///  this token at `_snapshotBlock`
      /// @param _snapshotBlock Block when the distribution of the parent token is
      ///  copied to set the initial distribution of the new clone token;
      ///  if the block is zero than the actual block, the current block is used
      /// @return The address of the new MiniMeToken Contract
      function createCloneToken(
          uint _snapshotBlock
          ) public returns(address) {
          if (_snapshotBlock == 0) _snapshotBlock = block.number;
              ReputationMiniMe cloneToken = tokenFactory.createCloneToken(
              this,
              _snapshotBlock
              );

          cloneToken.transferOwnership(msg.sender);
          //addAddressToWhitelist(address(cloneToken));
          //cloneToken.transferOwnership(msg.sender);

          // An event to make the token easy to find on the blockchain
          emit NewCloneReputaionToken(address(cloneToken), _snapshotBlock);
          return address(cloneToken);
      }

  ////////////////
  // Generate and destroy tokens
  ////////////////

      /// @notice Generates `_amount` tokens that are assigned to `_owner`
      /// @param _owner The address that will be assigned the new tokens
      /// @param _amount The quantity of tokens generated
      /// @return True if the tokens are generated correctly
      function mint(address _owner, uint _amount
      ) public onlyOwner returns (bool) {
          uint curTotalSupply = totalSupply();
          require(curTotalSupply + _amount >= curTotalSupply); // Check for overflow
          uint previousBalanceTo = balanceOf(_owner);
          require(previousBalanceTo + _amount >= previousBalanceTo); // Check for overflow
          updateValueAtNow(totalSupplyHistory, curTotalSupply + _amount);
          updateValueAtNow(balances[_owner], previousBalanceTo + _amount);
          emit Mint(_owner, _amount);
          return true;
      }

      /// @notice Burns `_amount` tokens from `_owner`
      /// @param _owner The address that will lose the tokens
      /// @param _amount The quantity of tokens to burn
      /// @return True if the tokens are burned correctly
      function burn(address _owner, uint _amount
      ) onlyOwner public returns (bool) {
          uint curTotalSupply = totalSupply();
          require(curTotalSupply >= _amount);
          uint previousBalanceFrom = balanceOf(_owner);
          require(previousBalanceFrom >= _amount);
          updateValueAtNow(totalSupplyHistory, curTotalSupply - _amount);
          updateValueAtNow(balances[_owner], previousBalanceFrom - _amount);
          emit Burn(_owner, _amount);
          return true;
      }


  ////////////////
  // Internal helper functions to query and set a value in a snapshot array
  ////////////////

      /// @dev `getValueAt` retrieves the number of tokens at a given block number
      /// @param checkpoints The history of values being queried
      /// @param _block The block number to retrieve the value at
      /// @return The number of tokens being queried
      function getValueAt(Checkpoint[] storage checkpoints, uint _block
      ) constant internal returns (uint) {
          if (checkpoints.length == 0) return 0;

          // Shortcut for the actual value
          if (_block >= checkpoints[checkpoints.length-1].fromBlock)
              return checkpoints[checkpoints.length-1].value;
          if (_block < checkpoints[0].fromBlock) return 0;

          // Binary search of the value in the array
          uint min = 0;
          uint max = checkpoints.length-1;
          while (max > min) {
              uint mid = (max + min + 1)/ 2;
              if (checkpoints[mid].fromBlock<=_block) {
                  min = mid;
              } else {
                  max = mid-1;
              }
          }
          return checkpoints[min].value;
      }

      /// @dev `updateValueAtNow` used to update the `balances` map and the
      ///  `totalSupplyHistory`
      /// @param checkpoints The history of data being updated
      /// @param _value The new number of tokens
      function updateValueAtNow(Checkpoint[] storage checkpoints, uint _value
      ) internal  {
          require(uint128(_value) == _value); //check value is in the 128 bits bounderies
          if ((checkpoints.length == 0)
          || (checkpoints[checkpoints.length -1].fromBlock < block.number)) {
                 Checkpoint storage newCheckPoint = checkpoints[ checkpoints.length++ ];
                 newCheckPoint.fromBlock =  uint128(block.number);
                 newCheckPoint.value = uint128(_value);
             } else {
                 Checkpoint storage oldCheckPoint = checkpoints[checkpoints.length-1];
                 oldCheckPoint.value = uint128(_value);
             }
      }

      /// @dev Helper function to return a min betwen the two uints
      function min(uint a, uint b) pure internal returns (uint) {
          return a < b ? a : b;
      }
  }


  ////////////////
  // MiniMeTokenFactory
  ////////////////

  /// @dev This contract is used to generate clone contracts from a contract.
  ///  In solidity this is the way to create a contract from a contract of the
  ///  same class
  contract ReputationMiniMeTokenFactory {

      /// @notice Update the DApp by creating a new token with new functionalities
      ///  the msg.sender becomes the controller of this clone token
      /// @param _parentToken Address of the token being cloned
      /// @param _snapshotBlock Block of the parent token that will
      ///  determine the initial distribution of the clone token
      /// @return The address of the new token contract
      function createCloneToken(
          address _parentToken,
          uint _snapshotBlock
      ) public returns (ReputationMiniMe) {
          ReputationMiniMe newToken = new ReputationMiniMe(
              this,
              _parentToken,
              _snapshotBlock
              );

          newToken.transferOwnership(msg.sender);
          return newToken;
      }
  }
