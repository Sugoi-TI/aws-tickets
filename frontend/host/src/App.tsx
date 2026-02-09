
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";


const API_URL = import.meta.env.VITE_API_URL;

function App() {

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div>
          app
        </div>
      )}
    </Authenticator>
  );
}

export default App;
