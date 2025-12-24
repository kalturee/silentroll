import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/GameApp.css';

type ActionState = 'idle' | 'joining' | 'starting' | 'guessing' | 'decrypting';

export function GameApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [guess, setGuess] = useState<boolean | null>(null);
  const [lastGuess, setLastGuess] = useState<boolean | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [clearPoints, setClearPoints] = useState<number | null>(null);
  const [clearRollSum, setClearRollSum] = useState<number | null>(null);

  const { data: joinedData, refetch: refetchJoined } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isJoined',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: roundActiveData, refetch: refetchRoundActive } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isRoundActive',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: pointsHandle, refetch: refetchPoints } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPoints',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!joinedData },
  });

  const { data: rollSumHandle, refetch: refetchRollSum } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLastRollSum',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!joinedData },
  });

  const isJoined = Boolean(joinedData);
  const isRoundActive = Boolean(roundActiveData);

  const derivedOutcome = useMemo(() => {
    if (clearRollSum === null || lastGuess === null) {
      return null;
    }
    return (clearRollSum >= 7) === lastGuess;
  }, [clearRollSum, lastGuess]);

  const refreshState = async () => {
    await Promise.all([refetchJoined(), refetchRoundActive(), refetchPoints(), refetchRollSum()]);
  };

  const handleJoin = async () => {
    if (!address || !signerPromise) {
      setStatusMessage('Connect your wallet to join.');
      return;
    }

    setActionState('joining');
    setStatusMessage('Signing join transaction...');

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.joinGame();
      setStatusMessage('Waiting for confirmation...');
      await tx.wait();
      await refreshState();
      setStatusMessage('Welcome to SilentRoll.');
    } catch (error) {
      setStatusMessage(`Join failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionState('idle');
    }
  };

  const handleStartRound = async () => {
    if (!address || !signerPromise) {
      setStatusMessage('Connect your wallet to start a round.');
      return;
    }

    setActionState('starting');
    setStatusMessage('Rolling encrypted dice...');

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.startRound();
      await tx.wait();
      await refreshState();
      setStatusMessage('Round active. Choose big or small.');
    } catch (error) {
      setStatusMessage(`Start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionState('idle');
    }
  };

  const handleSubmitGuess = async () => {
    if (!address || !signerPromise || !instance) {
      setStatusMessage('Wallet or encryption service not ready.');
      return;
    }
    if (guess === null) {
      setStatusMessage('Pick big or small first.');
      return;
    }

    setActionState('guessing');
    setStatusMessage('Encrypting your guess...');

    try {
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.addBool(guess);
      const encryptedInput = await input.encrypt();
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.submitGuess(encryptedInput.handles[0], encryptedInput.inputProof);
      setStatusMessage('Confirming your guess on-chain...');
      await tx.wait();
      setLastGuess(guess);
      setGuess(null);
      await refreshState();
      setStatusMessage('Guess resolved. Decrypt your stats to see the roll.');
    } catch (error) {
      setStatusMessage(`Guess failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionState('idle');
    }
  };

  const handleDecryptStats = async () => {
    if (!address || !signerPromise || !instance) {
      setStatusMessage('Wallet or encryption service not ready.');
      return;
    }
    if (!pointsHandle || !rollSumHandle) {
      setStatusMessage('No encrypted stats available yet.');
      return;
    }

    setActionState('decrypting');
    setStatusMessage('Preparing decryption request...');

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        { handle: pointsHandle as string, contractAddress: CONTRACT_ADDRESS },
        { handle: rollSumHandle as string, contractAddress: CONTRACT_ADDRESS },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      setClearPoints(Number(result[pointsHandle as string] ?? 0));
      setClearRollSum(Number(result[rollSumHandle as string] ?? 0));
      setStatusMessage('Stats decrypted.');
    } catch (error) {
      setStatusMessage(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionState('idle');
    }
  };

  return (
    <div className="game-app">
      <Header />
      <main className="game-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Encrypted Dice Ritual</p>
            <h2>Roll in the dark. Win in the clear.</h2>
            <p className="hero-subtitle">
              Two encrypted dice are rolled on-chain. Submit an encrypted big/small guess and claim 10,000 points on a
              win. Big means sum &gt;= 7. Small means sum &lt; 7.
            </p>
            <div className="rule-strip">
              <span>Reward: 10,000 points</span>
              <span>Dice: 1-6, twice</span>
              <span>Guess: encrypted</span>
            </div>
          </div>

          <div className="hero-card">
            <div className="card-header">
              <div>
                <h3>Player Console</h3>
                <p>{isConnected ? 'Wallet connected' : 'Connect wallet to start'}</p>
              </div>
              <div className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
            </div>

            <div className="card-section">
              <div className="state-row">
                <span>Enrollment</span>
                <strong>{isJoined ? 'Joined' : 'Not joined'}</strong>
              </div>
              <div className="state-row">
                <span>Round State</span>
                <strong>{isRoundActive ? 'Awaiting guess' : 'Idle'}</strong>
              </div>
              <div className="state-row">
                <span>Encryption</span>
                <strong>{zamaLoading ? 'Syncing' : zamaError ? 'Unavailable' : 'Ready'}</strong>
              </div>
            </div>

            <div className="card-section">
              <button
                className="primary-button"
                onClick={handleJoin}
                disabled={!isConnected || isJoined || actionState !== 'idle'}
              >
                {actionState === 'joining' ? 'Joining...' : isJoined ? 'Already Joined' : 'Join Game'}
              </button>
              <button
                className="secondary-button"
                onClick={handleStartRound}
                disabled={!isConnected || !isJoined || isRoundActive || actionState !== 'idle'}
              >
                {actionState === 'starting' ? 'Rolling...' : 'Start Round'}
              </button>
            </div>

            <div className="card-section">
              <div className="guess-toggle">
                <button
                  className={`toggle-button ${guess === true ? 'active' : ''}`}
                  onClick={() => setGuess(true)}
                  disabled={!isRoundActive || actionState !== 'idle'}
                >
                  Big
                </button>
                <button
                  className={`toggle-button ${guess === false ? 'active' : ''}`}
                  onClick={() => setGuess(false)}
                  disabled={!isRoundActive || actionState !== 'idle'}
                >
                  Small
                </button>
              </div>
              <button
                className="primary-button"
                onClick={handleSubmitGuess}
                disabled={!isRoundActive || guess === null || actionState !== 'idle' || zamaLoading}
              >
                {actionState === 'guessing' ? 'Submitting...' : zamaLoading ? 'Encrypting...' : 'Submit Guess'}
              </button>
            </div>

            <div className="card-section">
              <button
                className="ghost-button"
                onClick={handleDecryptStats}
                disabled={!isConnected || !isJoined || actionState !== 'idle'}
              >
                {actionState === 'decrypting' ? 'Decrypting...' : 'Decrypt My Stats'}
              </button>
              <p className="status-message">{statusMessage || 'Awaiting your next move.'}</p>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stats-card">
            <h4>Encrypted Vault</h4>
            <p>Points stay encrypted on-chain. Decrypt to reveal your balance.</p>
            <div className="stat-line">
              <span>Points</span>
              <strong>{clearPoints === null ? 'Hidden' : clearPoints.toLocaleString()}</strong>
            </div>
            <div className="stat-line">
              <span>Last Roll Sum</span>
              <strong>{clearRollSum === null ? 'Hidden' : clearRollSum}</strong>
            </div>
          </div>

          <div className="stats-card accent">
            <h4>Last Round Insight</h4>
            <p>Decrypt the roll to confirm the round outcome with your last guess.</p>
            <div className="stat-line">
              <span>Last Guess</span>
              <strong>
                {lastGuess === null ? 'None' : lastGuess ? 'Big (>= 7)' : 'Small (< 7)'}
              </strong>
            </div>
            <div className="stat-line">
              <span>Outcome</span>
              <strong>
                {derivedOutcome === null ? 'Pending' : derivedOutcome ? 'Win' : 'Miss'}
              </strong>
            </div>
            <div className="stat-hint">Outcome is computed locally once the roll is decrypted.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
