import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DuoFit</Text>
      <Text style={styles.subtitle}>Treinos inteligentes para nós dois.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F9F8',
    padding: 24,
  },
  title: {
    color: '#17211B',
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#526158',
    fontSize: 18,
    marginTop: 8,
    textAlign: 'center',
  },
});
