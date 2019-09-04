# ERC20_template
Template of the ERC20 contract that uses Sparse Merkle Tree instead storing balances.

The issue with a contract is a huge amount of gas. In master branch function transfer uses 809000 gas during execution.

Branch develop is created to reduce the gas amount.

For now using another approach with SMT library the gas amount that is required for transfer function is 578000.
