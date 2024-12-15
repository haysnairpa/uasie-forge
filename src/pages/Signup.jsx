import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name,
        email,
        createdAt: new Date().toISOString(),
        projects: [],
        recentActivity: []
      });

      navigate('/');
    } catch (error) {
      setError('Failed to create an account. ' + error.message);
    }
  };

  return (
    <div className="card max-w-md w-full mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-center text-secondary-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-secondary-600">
          Join us to start your journey
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-secondary-700">
            Full Name
          </label>
          <input
            type="text"
            required
            className="mt-1 input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

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
          Sign up
        </button>
      </form>
      <div className="text-center mt-4">
        <p className="text-sm text-secondary-600">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}