const SMT = artifacts.require("SMT");
const SafeMath = artifacts.require("SafeMath");
const ERC20 = artifacts.require("ERC20");

module.exports = function(deployer) {
  deployer.deploy(SMT);
  deployer.link(SMT, ERC20);
  deployer.deploy(ERC20, 10000);
};
