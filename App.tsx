import { AppLayout } from "./app/AppLayout";
import { GlobalProviders } from "./app/providers";
import Home from "./pages/Home";

export default function App() {
    return (
        <GlobalProviders>
            <AppLayout>
                <Home />
            </AppLayout>
        </GlobalProviders>
    );
}