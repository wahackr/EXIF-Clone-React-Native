import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/ui/home/HomeScreen';

export default function App() {
  return (
    <>
      <HomeScreen />
      <StatusBar style="auto" />
    </>
  );
}


