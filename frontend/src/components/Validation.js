import React, { useState } from 'react';
import { useContracts } from './ContractContext';

const ValidationPage = () => {
  const {contracts}=useContracts();
  const [tokenHash, setTokenHash] = useState('');
  const [signature, setSignature] = useState('');
  const [fileNames, setFileNames] = useState('');
  const [keys, setKeys] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const validateData = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setValidationResult(null);

    try {

      // Parse fileNames and keys into arrays
      const fileNameArray = fileNames.split(',').map(item => item.trim());
      const keyArray = keys.split(',').map(item => item.trim());

      // Call the validation function from your contract
      // This assumes your contract has a validate function
      const result = await contracts.validation.validateToken(
        tokenHash,
        signature,
        true,
        fileNameArray,
        keyArray
      );

      setValidationResult({
        isValid: result.isValid,
        message: result.message || 'Validation completed'
      });
    } catch (err) {
      setError(`Validation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="validation-page">
      <h1>Data Validation</h1>
      
      <form onSubmit={validateData} className="validation-form">
        <div className="form-group">
          <label htmlFor="tokenHash">Token Hash:</label>
          <input
            type="text"
            id="tokenHash"
            value={tokenHash}
            onChange={(e) => setTokenHash(e.target.value)}
            placeholder="Enter token hash"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="signature">Signature:</label>
          <textarea
            id="signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Paste signature here"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="fileNames">File Names (comma-separated):</label>
          <input
            type="text"
            id="fileNames"
            value={fileNames}
            onChange={(e) => setFileNames(e.target.value)}
            placeholder="file1.txt, file2.pdf"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="keys">Keys (comma-separated):</label>
          <input
            type="text"
            id="keys"
            value={keys}
            onChange={(e) => setKeys(e.target.value)}
            placeholder="key1, key2"
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          className="validate-button"
        >
          {isLoading ? 'Validating...' : 'Validate'}
        </button>
      </form>

      {validationResult && (
        <div className={`result ${validationResult.isValid ? 'success' : 'failure'}`}>
          <h3>Validation Result</h3>
          <p>Status: {validationResult.isValid ? 'Valid' : 'Invalid'}</p>
          <p>Message: {validationResult.message}</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default ValidationPage;