import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (error) {
      setError('Failed to login. Please check your credentials.');
    }
  };

  return (
    <div className="card max-w-md w-full mx-auto space-y-8">
  <div>
    <h2 className="text-2xl font-bold text-center text-secondary-900">
      Welcome back
    </h2>
    <p className="mt-2 text-center text-secondary-600">
      Sign in to your account
    </p>
  </div>
  
  <form onSubmit={handleSubmit} className="space-y-6">
    <div>
      <label className="block text-sm font-medium text-secondary-700">
        Email address
      </label>
      <input
        type="email"
        required
        className="mt-1 input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-secondary-700">
        Password
      </label>
      <input
        type="password"
        required
        className="mt-1 input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </div>

    <button type="submit" className="w-full btn btn-primary">
      Sign in
    </button>
  </form>
</div>
  );
}
