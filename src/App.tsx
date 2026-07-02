import { AppLayout } from "./app/AppLayout";
import { GlobalProviders } from "./app/providers";
import Home from "./pages/Home";

function App() {
  return (
    <GlobalProviders>
      <AppLayout>
        <Home />
      </AppLayout>
    </GlobalProviders>
  );
}

export default App;
