/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/health_fun.json`.
 */
export type HealthFun = {
  "address": "AurTvci86g6Wx95U93zQtonzV3CwHq7Ehpw9chS1oqCa",
  "metadata": {
    "name": "healthFun",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptAdmin",
      "discriminator": [
        112,
        42,
        45,
        90,
        116,
        181,
        13,
        170
      ],
      "accounts": [
        {
          "name": "newAdmin",
          "signer": true
        },
        {
          "name": "stakeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "stakeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "stakeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "treasuryAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "userAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "mint",
          "relations": [
            "stakeAccount",
            "treasuryConfig"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "stakeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxStake",
          "type": "u64"
        },
        {
          "name": "maxLockDuration",
          "type": "i64"
        },
        {
          "name": "minLockDuration",
          "type": "i64"
        },
        {
          "name": "verificationKey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeHealthData",
      "discriminator": [
        244,
        39,
        17,
        219,
        37,
        174,
        31,
        103
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "healthData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  101,
                  97,
                  108,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "stakeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "verificationKey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeTreasuryForMint",
      "discriminator": [
        83,
        105,
        247,
        74,
        152,
        89,
        160,
        222
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "stakeConfig"
          ]
        },
        {
          "name": "stakeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "treasuryAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "treasuryVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryAuthority"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "proposeAdmin",
      "discriminator": [
        121,
        214,
        199,
        212,
        87,
        39,
        117,
        234
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "stakeConfig"
          ]
        },
        {
          "name": "stakeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "stake",
      "discriminator": [
        206,
        176,
        202,
        18,
        200,
        209,
        179,
        108
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "stakeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "stakeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stakedAmount",
          "type": "u64"
        },
        {
          "name": "totalDays",
          "type": "u16"
        },
        {
          "name": "goalType",
          "type": {
            "defined": {
              "name": "goal"
            }
          }
        },
        {
          "name": "goalPerDay",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "stakeConfig"
          ]
        },
        {
          "name": "stakeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "configParams"
            }
          }
        }
      ]
    },
    {
      "name": "updateHealthData",
      "discriminator": [
        186,
        121,
        150,
        217,
        123,
        85,
        223,
        75
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "healthData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  101,
                  97,
                  108,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "stakeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stakeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "instructions",
          "docs": [
            "at runtime by comparing its address to `sysvar::instructions::id()`."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "attestationData",
          "type": {
            "defined": {
              "name": "attestationData"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawTreasury",
      "discriminator": [
        40,
        63,
        122,
        158,
        144,
        216,
        83,
        96
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "stakeConfig"
          ]
        },
        {
          "name": "stakeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "treasuryAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "mint",
          "relations": [
            "treasuryConfig"
          ]
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "healthData",
      "discriminator": [
        135,
        173,
        61,
        234,
        197,
        214,
        156,
        146
      ]
    },
    {
      "name": "stakeAccount",
      "discriminator": [
        80,
        158,
        67,
        124,
        50,
        189,
        192,
        255
      ]
    },
    {
      "name": "stakeConfig",
      "discriminator": [
        238,
        151,
        43,
        3,
        11,
        151,
        63,
        176
      ]
    },
    {
      "name": "treasuryConfig",
      "discriminator": [
        124,
        54,
        212,
        227,
        213,
        189,
        168,
        41
      ]
    },
    {
      "name": "userProfile",
      "discriminator": [
        32,
        37,
        119,
        205,
        179,
        180,
        13,
        194
      ]
    }
  ],
  "events": [
    {
      "name": "adminTransferProposed",
      "discriminator": [
        203,
        168,
        175,
        51,
        239,
        104,
        20,
        85
      ]
    },
    {
      "name": "adminTransferred",
      "discriminator": [
        255,
        147,
        182,
        5,
        199,
        217,
        38,
        179
      ]
    },
    {
      "name": "challengeSettled",
      "discriminator": [
        96,
        70,
        232,
        36,
        45,
        207,
        169,
        122
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "treasuryWithdrawn",
      "discriminator": [
        143,
        181,
        157,
        169,
        87,
        155,
        170,
        46
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAdminError",
      "msg": "Invalid admin pubkey"
    },
    {
      "code": 6001,
      "name": "maxStakeError",
      "msg": "Stake amount is higher than max stake"
    },
    {
      "code": 6002,
      "name": "durationOutOfRangeError",
      "msg": "Lock period is out of range"
    },
    {
      "code": 6003,
      "name": "invalidStakeOwnerError",
      "msg": "Stake owner is invalid"
    },
    {
      "code": 6004,
      "name": "invalidVerificationKeyError",
      "msg": "Invalid verification key used"
    },
    {
      "code": 6005,
      "name": "staleUpdateError",
      "msg": "Current time is in the past of last sync time"
    },
    {
      "code": 6006,
      "name": "invalidUserError",
      "msg": "Attested data has invalid user key"
    },
    {
      "code": 6007,
      "name": "attestationExpiredError",
      "msg": "Attestation data expired"
    },
    {
      "code": 6008,
      "name": "replayUpdateError",
      "msg": "Replay update of health data"
    },
    {
      "code": 6009,
      "name": "invalidEpochError",
      "msg": "Invalid epoch day in attestation"
    },
    {
      "code": 6010,
      "name": "missingEd25519IxError",
      "msg": "Current index of sysvar instructions not found or invalid"
    },
    {
      "code": 6011,
      "name": "invalidVerificationKeySignError",
      "msg": "Invalid signature for the payload data"
    },
    {
      "code": 6012,
      "name": "invalidInstructionError",
      "msg": "Invalid instruction address for signature verification"
    },
    {
      "code": 6013,
      "name": "invalidTreasuryVaultError",
      "msg": "Invalid vault pubkey for treasury"
    },
    {
      "code": 6014,
      "name": "alreadyClaimedError",
      "msg": "The staked challenge is already claimed"
    },
    {
      "code": 6015,
      "name": "stakeStillLockedError",
      "msg": "The challenge has not completed"
    },
    {
      "code": 6016,
      "name": "futureEpochError",
      "msg": "Attested epoch day is in the future"
    },
    {
      "code": 6017,
      "name": "zeroStakeError",
      "msg": "Stake amount must be greater than zero"
    },
    {
      "code": 6018,
      "name": "invalidConfigError",
      "msg": "Config values are invalid: max_stake must be positive and 0 <= min_lock_duration <= max_lock_duration"
    },
    {
      "code": 6019,
      "name": "zeroWithdrawalError",
      "msg": "Withdrawal amount must be greater than zero"
    }
  ],
  "types": [
    {
      "name": "adminTransferProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "docs": [
              "`Pubkey::default()` means a pending proposal was cancelled."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "adminTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previousAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "attestationData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "challengeId",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "steps",
            "type": "u32"
          },
          {
            "name": "sleepHours",
            "type": "u8"
          },
          {
            "name": "gym",
            "type": "bool"
          },
          {
            "name": "epochDay",
            "docs": [
              "Whole days since the Unix epoch, i.e. `unix_timestamp / 86400`.",
              "The oracle MUST use this numbering: it is compared directly against",
              "`stake_account.last_day_checked`, which the program derives from the",
              "chain clock. Any other scheme (days since challenge start, a calendar",
              "ordinal) silently stops goal progress from ever accruing."
            ],
            "type": "u16"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "challengeSettled",
      "docs": [
        "Emitted on settlement. The StakeAccount is closed straight afterwards, so",
        "this is the only per-challenge record that survives; the backend indexes it",
        "to build history, streaks and leaderboards."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "stakedAmount",
            "type": "u64"
          },
          {
            "name": "totalDays",
            "type": "u16"
          },
          {
            "name": "daysGoalMet",
            "type": "u16"
          },
          {
            "name": "goalPerDay",
            "type": "u32"
          },
          {
            "name": "won",
            "type": "bool"
          },
          {
            "name": "stakedAt",
            "type": "i64"
          },
          {
            "name": "settledAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "configParams",
      "docs": [
        "Full replacement of the mutable limits and the oracle key. Callers pass",
        "every value, including the ones they are not changing, so a stale client",
        "cannot accidentally revert a field it did not know about.",
        "",
        "Admin is deliberately not here: it moves via the two-step",
        "`propose_admin` / `accept_admin` so a mistyped key can never take",
        "authority without first proving it can sign."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxStake",
            "type": "u64"
          },
          {
            "name": "minLockDuration",
            "type": "i64"
          },
          {
            "name": "maxLockDuration",
            "type": "i64"
          },
          {
            "name": "verificationKey",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "docs": [
        "Emitted on every config change so key rotations and limit changes are",
        "auditable from transaction history alone."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "maxStake",
            "type": "u64"
          },
          {
            "name": "minLockDuration",
            "type": "i64"
          },
          {
            "name": "maxLockDuration",
            "type": "i64"
          },
          {
            "name": "verificationKey",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "goal",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "steps"
          },
          {
            "name": "sleep"
          },
          {
            "name": "gym"
          }
        ]
      }
    },
    {
      "name": "healthData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "lastSyncTimestamp",
            "type": "i64"
          },
          {
            "name": "epochDay",
            "type": "u16"
          },
          {
            "name": "steps",
            "type": "u32"
          },
          {
            "name": "sleepHours",
            "type": "u8"
          },
          {
            "name": "gym",
            "type": "bool"
          },
          {
            "name": "lastNonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stakeAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "stakedAmount",
            "type": "u64"
          },
          {
            "name": "stakedAt",
            "type": "i64"
          },
          {
            "name": "totalDays",
            "type": "u16"
          },
          {
            "name": "goalType",
            "type": {
              "defined": {
                "name": "goal"
              }
            }
          },
          {
            "name": "daysGoalMet",
            "type": "u16"
          },
          {
            "name": "lastDayChecked",
            "type": "u16"
          },
          {
            "name": "goalPerDay",
            "type": "u32"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "unlockAt",
            "type": "i64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stakeConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxStake",
            "type": "u64"
          },
          {
            "name": "maxLockDuration",
            "docs": [
              "Longest permitted challenge, as a DURATION IN SECONDS (not a timestamp).",
              "e.g. a 90-day maximum is 90 * 86400 = 7_776_000."
            ],
            "type": "i64"
          },
          {
            "name": "minLockDuration",
            "docs": [
              "Shortest permitted challenge, as a DURATION IN SECONDS (not a timestamp)."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "verificationKey",
            "docs": [
              "The oracle's ed25519 signing key. Rotatable via `update_config`; the",
              "new key takes effect for the next attestation of every user at once."
            ],
            "type": "pubkey"
          },
          {
            "name": "admin",
            "docs": [
              "Authority for `update_config`, `withdraw_treasury` and treasury setup.",
              "Set from the `ADMIN_KEY` bootstrap signer at `initialize_config` and",
              "rotatable afterwards, so the compiled-in key is only needed once."
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "docs": [
              "Two-step transfer target. `propose_admin` sets it; `accept_admin`,",
              "signed by this key, moves it into `admin`. Authority never changes",
              "hands until the new key has proven it can sign, so a mistyped pubkey",
              "cannot lock the protocol. `Pubkey::default()` means no transfer pending."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "treasuryConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "treasuryWithdrawn",
      "docs": [
        "Emitted on every withdrawal so treasury outflows are auditable."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userProfile",
      "docs": [
        "Permanent per-user record, created on the first challenge and never closed.",
        "",
        "The per-challenge `StakeAccount` is closed on claim so its rent goes back to",
        "the user, which means individual challenges leave no on-chain trace. This",
        "account keeps the parts that other on-chain programs could want to read —",
        "aggregates, not history — at a one-time rent cost instead of one rent",
        "payment per challenge. Full per-challenge detail is emitted as a",
        "`ChallengeSettled` event for the backend to index."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "challengesCompleted",
            "docs": [
              "Challenges settled with `days_goal_met >= total_days`."
            ],
            "type": "u32"
          },
          {
            "name": "challengesFailed",
            "docs": [
              "Challenges settled short of the goal, where the stake was forfeited."
            ],
            "type": "u32"
          },
          {
            "name": "currentStreak",
            "docs": [
              "Consecutive completed challenges; reset to 0 by a forfeit."
            ],
            "type": "u32"
          },
          {
            "name": "longestStreak",
            "docs": [
              "Highest `current_streak` ever reached."
            ],
            "type": "u32"
          },
          {
            "name": "totalStaked",
            "docs": [
              "Lifetime total staked, in the mint's base units. Sums across mints, so",
              "it is only meaningful when a single mint is in use."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "seed",
      "type": "string",
      "value": "\"anchor\""
    }
  ]
};
