import MainLayout from "./layout/MainLayout";
import { GameProvider } from "./context/GameContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

export default function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <MainLayout />
      </GameProvider>
    </AuthProvider>
  );
}
