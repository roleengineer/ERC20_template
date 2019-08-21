pragma solidity ^0.5.0;


library SMT {

  struct Data {
    uint8 DEPTH;
    bytes32[161] defaultHashes;
    bytes32 root;
  }


  function read(Data storage self, uint160 key, bytes32 leaf, bytes memory proof) public view returns (bool) {
    bytes32 calculatedRoot = getRoot(self, leaf, key, proof);
    return (calculatedRoot == self.root);
  }

  function write(Data storage self, uint160 key, bytes32 prevLeaf, bytes memory proof, bytes32 newLeaf) public {
    bytes32 calculatedRoot = getRoot(self, prevLeaf, key, proof);
    require(calculatedRoot == self.root, "update proof not valid");
    self.root = getRoot(self, newLeaf, key, proof);
  }

  function del(Data storage self, uint160 key, bytes32 prevLeaf, bytes memory proof) public {
    bytes32 calculatedRoot = getRoot(self, prevLeaf, key, proof);
    require(calculatedRoot == self.root, "update proof not valid");
    self.root = getRoot(self, self.defaultHashes[0], key, proof);
  }

  // first 160 bits of the proof are the 0/1 bits
  function getRoot(Data storage self, bytes32 leaf, uint160 _index, bytes memory proof) public view returns (bytes32) {
    require((proof.length - 20) % 32 == 0 && proof.length <= 5140, "invalid proof format");
    bytes32 proofElement;
    bytes32 computedHash = leaf;
    uint16 p = 20;
    uint160 proofBits;
    uint160 index = _index;
    assembly {proofBits := div(mload(add(proof, 32)), exp(256, 12))}

    for (uint d = 0; d < self.DEPTH; d++ ) {
      if (proofBits % 2 == 0) { // check if last bit of proofBits is 0
        proofElement = self.defaultHashes[d];
      } else {
        p += 32;
        require(proof.length >= p, "proof not long enough");
        assembly { proofElement := mload(add(proof, p)) }
      }
      if (index % 2 == 0) {
        computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
      } else {
        computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
      }
      proofBits = proofBits / 2; // shift it right for next bit
      index = index / 2;
    }
    return computedHash;
  }
}
