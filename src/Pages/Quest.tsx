import { useParams } from "react-router-dom";

export default function Quest() {
  const { id } = useParams(); // "100001577" or "100001576"

  return (
    <>
      <h1>Quest Page</h1>
      <p>Extracted Quest ID: {id}</p>
    </>
  );
}
