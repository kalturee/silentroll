// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SilentRoll
/// @notice Encrypted big/small dice game using Zama FHE randomness.
contract SilentRoll is ZamaEthereumConfig {
    uint32 public constant REWARD_POINTS = 10000;
    uint32 public constant BIG_THRESHOLD = 7;

    mapping(address => bool) private _joined;
    mapping(address => bool) private _roundActive;
    mapping(address => euint32) private _points;
    mapping(address => euint32) private _rollSum;
    mapping(address => ebool) private _lastOutcome;

    event GameJoined(address indexed player);
    event RoundStarted(address indexed player);
    event GuessSubmitted(address indexed player);

    /// @notice Join the game and initialize encrypted points.
    function joinGame() external {
        require(!_joined[msg.sender], "Already joined");

        _joined[msg.sender] = true;
        _roundActive[msg.sender] = false;

        _points[msg.sender] = FHE.asEuint32(0);
        _rollSum[msg.sender] = FHE.asEuint32(0);
        _lastOutcome[msg.sender] = FHE.asEbool(false);

        FHE.allowThis(_points[msg.sender]);
        FHE.allow(_points[msg.sender], msg.sender);
        FHE.allowThis(_rollSum[msg.sender]);
        FHE.allow(_rollSum[msg.sender], msg.sender);
        FHE.allowThis(_lastOutcome[msg.sender]);
        FHE.allow(_lastOutcome[msg.sender], msg.sender);

        emit GameJoined(msg.sender);
    }

    /// @notice Start a round by rolling two encrypted dice (1-6).
    function startRound() external {
        require(_joined[msg.sender], "Join first");
        require(!_roundActive[msg.sender], "Round already active");

        euint32 dice1 = FHE.add(FHE.randEuint32(6), FHE.asEuint32(1));
        euint32 dice2 = FHE.add(FHE.randEuint32(6), FHE.asEuint32(1));
        _rollSum[msg.sender] = FHE.add(dice1, dice2);
        _roundActive[msg.sender] = true;

        FHE.allowThis(_rollSum[msg.sender]);

        emit RoundStarted(msg.sender);
    }

    /// @notice Submit encrypted guess (true = big, false = small) and resolve the round.
    function submitGuess(externalEbool guess, bytes calldata inputProof) external {
        require(_joined[msg.sender], "Join first");
        require(_roundActive[msg.sender], "No active round");

        ebool encryptedGuess = FHE.fromExternal(guess, inputProof);
        ebool isBig = FHE.ge(_rollSum[msg.sender], FHE.asEuint32(BIG_THRESHOLD));
        ebool isCorrect = FHE.eq(encryptedGuess, isBig);
        euint32 reward = FHE.select(isCorrect, FHE.asEuint32(REWARD_POINTS), FHE.asEuint32(0));

        _points[msg.sender] = FHE.add(_points[msg.sender], reward);
        _lastOutcome[msg.sender] = isCorrect;
        _roundActive[msg.sender] = false;

        FHE.allowThis(_points[msg.sender]);
        FHE.allow(_points[msg.sender], msg.sender);
        FHE.allowThis(_rollSum[msg.sender]);
        FHE.allow(_rollSum[msg.sender], msg.sender);
        FHE.allowThis(_lastOutcome[msg.sender]);
        FHE.allow(_lastOutcome[msg.sender], msg.sender);

        emit GuessSubmitted(msg.sender);
    }

    /// @notice Returns whether a player has joined.
    function isJoined(address player) external view returns (bool) {
        return _joined[player];
    }

    /// @notice Returns whether a player has an active round.
    function isRoundActive(address player) external view returns (bool) {
        return _roundActive[player];
    }

    /// @notice Returns encrypted points for a player.
    function getPoints(address player) external view returns (euint32) {
        return _points[player];
    }

    /// @notice Returns encrypted last roll sum for a player.
    function getLastRollSum(address player) external view returns (euint32) {
        return _rollSum[player];
    }

    /// @notice Returns encrypted last outcome for a player.
    function getLastOutcome(address player) external view returns (ebool) {
        return _lastOutcome[player];
    }
}
