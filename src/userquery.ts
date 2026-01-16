import { gql } from "@apollo/client";

export const GET_USER = gql `
query GET_USER {
getUser{
id
name
email
}
}
`;

export const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!) {
    createUser(name: $name, email: $email) {
      id
      name
      email
    }
  }
`;

