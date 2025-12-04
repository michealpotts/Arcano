import MainLayout from "./layout/MainLayout";
import { GameProvider } from "./context/GameContext.jsx";

export default function App() {
  return (
    <GameProvider>
      <MainLayout />
    </GameProvider>
  );
}
