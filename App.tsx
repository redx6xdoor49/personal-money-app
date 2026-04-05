import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Tx = { id: string; title: string; amount: number; category: string; type: 'income' | 'expense'; date: string };

function money(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

export default function App() {
  const [items, setItems] = useState<Tx[]>([
    { id: '1', title: 'Paycheck', amount: 3200, category: 'Income', type: 'income', date: '2026-04-01' },
    { id: '2', title: 'Rent', amount: 1450, category: 'Housing', type: 'expense', date: '2026-04-02' },
  ]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  const totals = useMemo(() => {
    const income = items.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expenses = items.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [items]);

  const add = () => {
    const n = Number(amount);
    if (!title.trim() || !category.trim() || !amount.trim() || !Number.isFinite(n) || n <= 0) {
      Alert.alert('Missing info', 'Add title, amount, and category.');
      return;
    }
    setItems((cur) => [
      { id: String(Date.now()), title: title.trim(), amount: n, category: category.trim(), type, date: new Date().toISOString().slice(0, 10) },
      ...cur,
    ]);
    setTitle(''); setAmount(''); setCategory(''); setType('expense'); setOpen(false);
  };

return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Money at a glance</Text>
        <Text style={s.sub}>Simple offline tracker.</Text>

        <View style={s.card}>
          <Text style={s.label}>Balance</Text>
          <Text style={s.balance}>{money(totals.balance)}</Text>
          <Text style={s.small}>Income: {money(totals.income)}</Text>
          <Text style={s.small}>Expenses: {money(totals.expenses)}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.section}>Transactions</Text>
          <Pressable style={s.btn} onPress={() => setOpen(true)}>
            <Text style={s.btnText}>Add</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          {items.map((t) => (
            <View key={t.id} style={s.tx}>
              <View style={{ flex: 1 }}>
                <Text style={s.txTitle}>{t.title}</Text>
                <Text style={s.small}>{t.category} • {t.date}</Text>
              </View>
              <Text style={t.type === 'income' ? s.income : s.expense}>
                {t.type === 'income' ? '+' : '-'}{money(t.amount)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={open} animationType="slide" transparent>
        <View style={s.backdrop}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Add transaction</Text>
            <TextInput style={s.input} placeholder="Title" placeholderTextColor="#64748b" value={title} onChangeText={setTitle} />
            <TextInput style={s.input} placeholder="Amount" placeholderTextColor="#64748b" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <TextInput style={s.input} placeholder="Category" placeholderTextColor="#64748b" value={category} onChangeText={setCategory} />
            <View style={s.toggleRow}>
              <Pressable style={[s.toggle, type === 'expense' && s.toggleActive]} onPress={() => setType('expense')}>
                <Text style={type === 'expense' ? s.toggleTextActive : s.toggleText}>Expense</Text>
              </Pressable>
              <Pressable style={[s.toggle, type === 'income' && s.toggleActive]} onPress={() => setType('income')}>
                <Text style={type === 'income' ? s.toggleTextActive : s.toggleText}>Income</Text>
              </Pressable>
            </View>
            <View style={s.actions}>
              <Pressable style={[s.btn, s.gray]} onPress={() => setOpen(false)}>
                <Text style={s.btnText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.btn} onPress={add}>
                <Text style={s.btnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  container: { padding: 20, gap: 16, backgroundColor: '#0f172a' },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '800' },
  sub: { color: '#cbd5e1', fontSize: 15 },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 },
  label: { color: '#94a3b8', fontSize: 12 },
  balance: { color: '#fff', fontSize: 32, fontWeight: '800' },
  small: { color: '#cbd5e1', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  btn: { backgroundColor: '#38bdf8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  gray: { backgroundColor: '#334155' },
  btnText: { color: '#082f49', fontWeight: '800' },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  txTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  income: { color: '#4ade80', fontWeight: '700' },
  expense: { color: '#f87171', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#0f172a', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  input: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 12, padding: 12 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: { flex: 1, borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, alignItems: 'center' },
  toggleActive: { backgroundColor: '#e2e8f0', borderColor: '#e2e8f0' },
  toggleText: { color: '#cbd5e1', fontWeight: '700' },
  toggleTextActive: { color: '#0f172a', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
});