/**
 * Copyright (c) 2019-present, deora.earth
 *
 * This source code is licensed under the Mozilla Public License, version 2,
 * found in the LICENSE file in the root directory of this source tree.
 */
 
pragma solidity ^0.5.0;


library SMT {

  function read(bytes32 root, uint160 key, bytes32 leaf, bytes memory proof) internal pure returns (bool) {
    bytes32 calculatedRoot = getRoot(leaf, key, proof);
    return (calculatedRoot == root);
  }

  function write(bytes32 root, uint160 key, bytes32 prevLeaf, bytes memory proof, bytes32 newLeaf) internal pure returns(bytes32)  {
    bytes32 calculatedRoot = getRoot(prevLeaf, key, proof);
    require(calculatedRoot == root, "update proof not valid");
    bytes32 new_root = getRoot(newLeaf, key, proof);
    return new_root;
  }

  function del(bytes32 root, uint160 key, bytes32 prevLeaf, bytes memory proof) internal pure returns(bytes32) {
    bytes32 calculatedRoot = getRoot(prevLeaf, key, proof);
    require(calculatedRoot == root, "update proof not valid");
    bytes32 new_root = getRoot(0, key, proof);
    return new_root;
  }

  // first 160 bits of the proof are the 0/1 bits
  function getRoot(bytes32 leaf, uint160 _index, bytes memory proof) internal pure returns (bytes32) {
    return _getRoot(leaf, _index, proof);
  }


  function _getRoot(bytes32 leaf, uint160 _index, bytes memory proof) internal pure returns (bytes32) {
    require((proof.length - 20) % 32 == 0 && proof.length <= 5140, "invalid proof format");
    bytes32 proofElement;
    bytes32 computedHash = leaf;
    uint16 p = 20;
    uint160 proofBits;
    uint160 index = _index;
    assembly {proofBits := div(mload(add(proof, 32)), exp(256, 12))}

    for (uint d = 0; d < 160; d++ ) {
      if (proofBits % 2 == 0) { // check if last bit of proofBits is 0
        proofElement = 0;
      } else {
        p += 32;
        require(proof.length >= p, "proof not long enough");
        assembly { proofElement := mload(add(proof, p)) }
      }
      if (computedHash == 0 && proofElement == 0) {
        computedHash = 0;
      } else if (index % 2 == 0) {
        assembly {
          mstore(0, computedHash)
          mstore(0x20, proofElement)
          computedHash := keccak256(0, 0x40)
        }
      } else {
        assembly {
          mstore(0, proofElement)
          mstore(0x20, computedHash)
          computedHash := keccak256(0, 0x40)
        }
      }
      proofBits = proofBits / 2; // shift it right for next bit
      index = index / 2;
    }
    return computedHash;
  }

}
