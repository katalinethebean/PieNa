import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { FriendProvider } from './contexts/FriendContext.jsx'
import { UserProvider } from './contexts/UserContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { MatchInviteProvider } from './contexts/MatchInviteContext.jsx'
import { ChatProvider } from './contexts/ChatContext.jsx'
import { LanguageProvider } from './contexts/LanguageContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
        <UserProvider>
          <FriendProvider>
            <ChatProvider>
              <MatchInviteProvider>
                <App />
              </MatchInviteProvider>
            </ChatProvider>
          </FriendProvider>
        </UserProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
