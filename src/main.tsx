import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Apollo v4+ React 19 imports (✅ WORKS)
import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { ApolloProvider } from '@apollo/client/react'
import { HttpLink,gql } from '@apollo/client'
import App from './App.tsx'

const client = new ApolloClient({
  link: new HttpLink({uri:"http://localhost:4000/graphql"}),
  cache: new InMemoryCache()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </StrictMode>
)
