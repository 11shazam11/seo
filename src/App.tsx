import { useQuery, useMutation } from '@apollo/client/react';
import { GET_USER, CREATE_USER } from './userquery'; // Adjust path

function App() {
  const { data: userData, loading } = useQuery(GET_USER);
  const [createUser] = useMutation(CREATE_USER);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {userData?.getUser && (
        <p>Welcome, {userData.getUser.name}! ({userData.getUser.email})</p>
      )}
      <button onClick={() => createUser({ variables: { name: 'John', email: 'john@example.com' } })}>
        Create User
      </button>
    </div>
  );
}
export default App;