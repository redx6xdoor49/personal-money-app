import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TransactionType = 'income' | 'expense';

type Transaction = {
  id: string;
  title: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
};

type Budget = {
  category: string;
  limit: number;
};

type Goal = {
  name: string;
  target: number;
  saved: number;
};

type RecurringBill = {
  name: string;
  amount: number;
  dueDay: number;
  category: string;
};

type StoredState = {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: RecurringBill[];
};

const STORAGE_KEY = 'personal-money-app:v1';

const initialState: StoredState = {
  transactions: [
    { id: '1', title: 'Paycheck', amount: 3200, category: 'Income', type: 'income', date: '2026-04-01' },
    { id: '2', title: 'Rent', amount: 1450, category: 'Housing', type: 'expense', date: '2026-04-02' },
    { id: '3', title: 'Groceries', amount: 86.14, category: 'Food', type: 'expense', date: '2026-04-03' },
    { id: '4', title: 'Gas', amount: 42.5, category: 'Transport', type: 'expense', date: '2026-04-04' },
  ],
  budgets: [
    { category: 'Housing', limit: 1600 },
    { category: 'Food', limit: 500 },
    { category: 'Transport', limit: 300 },
    { category: 'Entertainment', limit: 200 },
  ],
  goals: [
    { name: 'Emergency fund', target: 5000, saved: 1250 },
    { name: 'Vacation', target: 2000, saved: 400 },
    { name: 'New phone', target: 1200, saved: 300 },
  ],
  bills: [
    { name: 'Rent', amount: 1450, dueDay: 1, category: 'Housing' },
    { name: 'Phone', amount: 65, dueDay: 12, category: 'Utilities' },
    { name: 'Streaming', amount: 18, dueDay: 21, category: 'Entertainment' },
  ],
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function progressColor(pct: number) {
  if (pct >= 100) return '#f87171';
  if (pct >= 80) return '#fbbf24';
  return '#4ade80';
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(initialState.transactions);
  const [budgets, setBudgets] = useState<Budget[]>(initialState.budgets);
  const [goals, setGoals] = useState<Goal[]>(initialState.goals);
  const [bills, setBills] = useState<RecurringBill[]>(initialState.bills);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredState;
          setTransactions(parsed.transactions ?? initialState.transactions);
          setBudgets(parsed.budgets ?? initialState.budgets);
          setGoals(parsed.goals ?? initialState.goals);
          setBills(parsed.bills ?? initialState.bills);
        }
      } catch {
        // keep defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const payload: StoredState = { transactions, budgets, goals, bills };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => null);
  }, [transactions, budgets, goals, bills, loaded]);

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expenses;
    return { income, expenses, balance };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...transactions].filter((t) => {
      if (!q) return true;
      return [t.title, t.category, t.date, t.type].some((v) => v.toLowerCase().includes(q));
    });
  }, [transactions, search]);

  const budgetStats = useMemo(() => {
    return budgets.map((budget) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category.toLowerCase() === budget.category.toLowerCase())
        .reduce((sum, t) => sum + t.amount, 0);
      const pct = budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0;
      return { ...budget, spent, pct };
    });
  }, [budgets, transactions]);

  const goalStats = useMemo(() => {
    return goals.map((goal) => ({ ...goal, pct: goal.target > 0 ? Math.round((goal.saved / goal.target) * 100) : 0 }));
  }, [goals]);

  const addOrUpdateTransaction = () => {
    const parsed = Number(amount);
    if (!title.trim() || !category.trim() || !amount.trim() || Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Missing info', 'Add a title, amount, and category.');
      return;
    }

    const payload: Transaction = {
      id: editingId ?? String(Date.now()),
      title: title.trim(),
      amount: parsed,
      category: category.trim(),
      type,
      date: new Date().toISOString().slice(0, 10),
    };

    setTransactions((current) => (editingId ? current.map((t) => (t.id === editingId ? payload : t)) : [payload, ...current]));
    resetModal();
  };

  const openNewTransaction = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setCategory('');
    setType('expense');
    setModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingId(tx.id);
    setTitle(tx.title);
    setAmount(String(tx.amount));
    setCategory(tx.category);
    setType(tx.type);
    setModalOpen(true);
  };

  const resetModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTitle('');
    setAmount('');
    setCategory('');
    setType('expense');
  };

  const deleteTransaction = (id: string) => {
    setTransactions((current) => current.filter((t) => t.id !== id));
  };

  const addQuickGoalContribution = (goalName: string, value: number) => {
    setGoals((current) => current.map((g) => (g.name === goalName ? { ...g, saved: g.saved + value } : g)));
  };

  const addBill = () => {
    const name = `Bill ${bills.length + 1}`;
    setBills((current) => [{ name, amount: 0, dueDay: 1, category: 'Other' }, ...current]);
  };

  const exportData = async () => {
    try {
      const payload: StoredState = { transactions, budgets, goals, bills };
      await AsyncStorage.setItem(`${STORAGE_KEY}:export`, JSON.stringify(payload, null, 2));
      Alert.alert('Saved', 'Your data is stored locally on this device.');
    } catch {
      Alert.alert('Error', 'Could not save your data.');
    }
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading your money data…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Personal money app</Text>
          <Text style={styles.title}>Money at a glance</Text>
          <Text style={styles.subtitle}>Offline-first MVP with local persistence on this device.</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current balance</Text>
          <Text style={styles.balanceValue}>{money(totals.balance)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Income</Text>
              <Text style={styles.balancePillValue}>{money(totals.income)}</Text>
            </View>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Expenses</Text>
              <Text style={styles.balancePillValue}>{money(totals.expenses)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budgets</Text>
          <Text style={styles.sectionNote}>Monthly limits</Text>
        </View>
        <View style={styles.card}>
          {budgetStats.map((budget) => (
            <View key={budget.category} style={styles.progressItem}>
              <View style={styles.progressTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{budget.category}</Text>
                  <Text style={styles.rowMeta}>
                    {money(budget.spent)} of {money(budget.limit)}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: progressColor(budget.pct) }]}>{budget.pct}%</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, budget.pct)}%`, backgroundColor: progressColor(budget.pct) },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <Pressable style={styles.smallButton} onPress={() => addQuickGoalContribution('Emergency fund', 25)}>
            <Text style={styles.smallButtonText}>+ $25 to Emergency</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {goalStats.map((goal) => (
            <View key={goal.name} style={styles.progressItem}>
              <View style={styles.progressTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{goal.name}</Text>
                  <Text style={styles.rowMeta}>
                    {money(goal.saved)} saved of {money(goal.target)}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: progressColor(goal.pct) }]}>{goal.pct}%</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, goal.pct)}%`, backgroundColor: progressColor(goal.pct) },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recurring bills</Text>
          <Pressable style={styles.smallButton} onPress={addBill}>
            <Text style={styles.smallButtonText}>Add bill</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {bills.map((bill) => (
            <View key={`${bill.name}-${bill.dueDay}-${bill.category}`} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{bill.name}</Text>
                <Text style={styles.rowMeta}>
                  Due day {bill.dueDay} • {bill.category}
                </Text>
              </View>
              <Text style={styles.rowValue}>{money(bill.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Pressable style={styles.button} onPress={openNewTransaction}>
            <Text style={styles.buttonText}>Add</Text>
          </Pressable>
        </View>

        <TextInput
          placeholder="Search transactions"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.card}>
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.emptyText}>No transactions match your search.</Text>}
            renderItem={({ item }) => (
              <View style={styles.txRow}>
                <Pressable style={{ flex: 1 }} onPress={() => openEditTransaction(item)}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>
                    {item.category} • {item.date}
                  </Text>
                </Pressable>
                <View style={styles.txActions}>
                  <Text style={[styles.rowValue, item.type === 'income' ? styles.income : styles.expense]}>
                    {item.type === 'income' ? '+' : '-'}
                    {money(item.amount)}
                  </Text>
                  <Pressable onPress={() => deleteTransaction(item.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>

        <Pressable style={styles.exportButton} onPress={exportData}>
          <Text style={styles.exportButtonText}>Save local backup</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit transaction' : 'Add transaction'}</Text>
            <TextInput
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholderTextColor="#64748b"
            />
            <TextInput
              placeholder="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholderTextColor="#64748b"
            />
            <TextInput
              placeholder="Category"
              value={category}
              onChangeText={setCategory}
              style={styles.input}
              placeholderTextColor="#64748b"
            />

            <View style={styles.toggleRow}>
              <Pressable style={[styles.toggle, type === 'expense' && styles.toggleActive]} onPress={() => setType('expense')}>
                <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
              </Pressable>
              <Pressable style={[styles.toggle, type === 'income' && styles.toggleActive]} onPress={() => setType('income')}>
                <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>Income</Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={[styles.button, styles.buttonGhost]} onPress={resetModal}>
                <Text style={[styles.buttonText, styles.buttonGhostText]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={addOrUpdateTransaction}>
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f172a' },
  loadingWrap: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: '#cbd5e1', fontSize: 16 },
  container: { padding: 20, gap: 18, backgroundColor: '#0f172a' },
  header: { gap: 6 },
  kicker: { color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#cbd5e1', fontSize: 15, lineHeight: 21 },
  balanceCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 18, gap: 14 },
  balanceLabel: { color: '#94a3b8', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 34, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', gap: 10 },
  balancePill: { flex: 1, backgroundColor: '#0f172a', padding: 12, borderRadius: 14 },
  balancePillLabel: { color: '#94a3b8', fontSize: 12 },
  balancePillValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  sectionNote: { color: '#94a3b8', fontSize: 13 },
  card: { backgroundColor: '#111827', borderRadius: 18, padding: 16, gap: 12 },
  rowTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  rowMeta: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  rowValue: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  income: { color: '#4ade80' },
  expense: { color: '#f87171' },
  separator: { height: 1, backgroundColor: '#1f2937' },
  button: { backgroundColor: '#38bdf8', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { color: '#082f49', fontWeight: '800' },
  buttonGhost: { backgroundColor: '#1f2937' },
  buttonGhostText: { color: '#e2e8f0' },
  smallButton: { backgroundColor: '#1f2937', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  smallButtonText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  progressItem: { gap: 8 },
  progressTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBarBackground: { height: 10, borderRadius: 999, backgroundColor: '#1f2937', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999 },
  searchInput: { backgroundColor: '#1e293b', color: '#fff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  txActions: { alignItems: 'flex-end', gap: 6 },
  deleteText: { color: '#fca5a5', fontWeight: '700', fontSize: 12 },
  emptyText: { color: '#94a3b8', textAlign: 'center', paddingVertical: 8 },
  exportButton: { backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  exportButtonText: { color: '#052e16', fontWeight: '900', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f172a', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  input: { backgroundColor: '#1e293b', color: '#fff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: { flex: 1, borderWidth: 1, borderColor: '#334155', padding: 12, borderRadius: 12, alignItems: 'center' },
  toggleActive: { backgroundColor: '#e2e8f0', borderColor: '#e2e8f0' },
  toggleText: { color: '#cbd5e1', fontWeight: '700' },
  toggleTextActive: { color: '#0f172a' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
EOFcat > App.tsx <<'EOF'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TransactionType = 'income' | 'expense';

type Transaction = {
  id: string;
  title: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
};

type Budget = {
  category: string;
  limit: number;
};

type Goal = {
  name: string;
  target: number;
  saved: number;
};

type RecurringBill = {
  name: string;
  amount: number;
  dueDay: number;
  category: string;
};

type StoredState = {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: RecurringBill[];
};

const STORAGE_KEY = 'personal-money-app:v1';

const initialState: StoredState = {
  transactions: [
    { id: '1', title: 'Paycheck', amount: 3200, category: 'Income', type: 'income', date: '2026-04-01' },
    { id: '2', title: 'Rent', amount: 1450, category: 'Housing', type: 'expense', date: '2026-04-02' },
    { id: '3', title: 'Groceries', amount: 86.14, category: 'Food', type: 'expense', date: '2026-04-03' },
    { id: '4', title: 'Gas', amount: 42.5, category: 'Transport', type: 'expense', date: '2026-04-04' },
  ],
  budgets: [
    { category: 'Housing', limit: 1600 },
    { category: 'Food', limit: 500 },
    { category: 'Transport', limit: 300 },
    { category: 'Entertainment', limit: 200 },
  ],
  goals: [
    { name: 'Emergency fund', target: 5000, saved: 1250 },
    { name: 'Vacation', target: 2000, saved: 400 },
    { name: 'New phone', target: 1200, saved: 300 },
  ],
  bills: [
    { name: 'Rent', amount: 1450, dueDay: 1, category: 'Housing' },
    { name: 'Phone', amount: 65, dueDay: 12, category: 'Utilities' },
    { name: 'Streaming', amount: 18, dueDay: 21, category: 'Entertainment' },
  ],
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function progressColor(pct: number) {
  if (pct >= 100) return '#f87171';
  if (pct >= 80) return '#fbbf24';
  return '#4ade80';
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(initialState.transactions);
  const [budgets, setBudgets] = useState<Budget[]>(initialState.budgets);
  const [goals, setGoals] = useState<Goal[]>(initialState.goals);
  const [bills, setBills] = useState<RecurringBill[]>(initialState.bills);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredState;
          setTransactions(parsed.transactions ?? initialState.transactions);
          setBudgets(parsed.budgets ?? initialState.budgets);
          setGoals(parsed.goals ?? initialState.goals);
          setBills(parsed.bills ?? initialState.bills);
        }
      } catch {
        // keep defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const payload: StoredState = { transactions, budgets, goals, bills };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => null);
  }, [transactions, budgets, goals, bills, loaded]);

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expenses;
    return { income, expenses, balance };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...transactions].filter((t) => {
      if (!q) return true;
      return [t.title, t.category, t.date, t.type].some((v) => v.toLowerCase().includes(q));
    });
  }, [transactions, search]);

  const budgetStats = useMemo(() => {
    return budgets.map((budget) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category.toLowerCase() === budget.category.toLowerCase())
        .reduce((sum, t) => sum + t.amount, 0);
      const pct = budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0;
      return { ...budget, spent, pct };
    });
  }, [budgets, transactions]);

  const goalStats = useMemo(() => {
    return goals.map((goal) => ({ ...goal, pct: goal.target > 0 ? Math.round((goal.saved / goal.target) * 100) : 0 }));
  }, [goals]);

  const addOrUpdateTransaction = () => {
    const parsed = Number(amount);
    if (!title.trim() || !category.trim() || !amount.trim() || Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Missing info', 'Add a title, amount, and category.');
      return;
    }

    const payload: Transaction = {
      id: editingId ?? String(Date.now()),
      title: title.trim(),
      amount: parsed,
      category: category.trim(),
      type,
      date: new Date().toISOString().slice(0, 10),
    };

    setTransactions((current) => (editingId ? current.map((t) => (t.id === editingId ? payload : t)) : [payload, ...current]));
    resetModal();
  };

  const openNewTransaction = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setCategory('');
    setType('expense');
    setModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingId(tx.id);
    setTitle(tx.title);
    setAmount(String(tx.amount));
    setCategory(tx.category);
    setType(tx.type);
    setModalOpen(true);
  };

  const resetModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTitle('');
    setAmount('');
    setCategory('');
    setType('expense');
  };

  const deleteTransaction = (id: string) => {
    setTransactions((current) => current.filter((t) => t.id !== id));
  };

  const addQuickGoalContribution = (goalName: string, value: number) => {
    setGoals((current) => current.map((g) => (g.name === goalName ? { ...g, saved: g.saved + value } : g)));
  };

  const addBill = () => {
    const name = `Bill ${bills.length + 1}`;
    setBills((current) => [{ name, amount: 0, dueDay: 1, category: 'Other' }, ...current]);
  };

  const exportData = async () => {
    try {
      const payload: StoredState = { transactions, budgets, goals, bills };
      await AsyncStorage.setItem(`${STORAGE_KEY}:export`, JSON.stringify(payload, null, 2));
      Alert.alert('Saved', 'Your data is stored locally on this device.');
    } catch {
      Alert.alert('Error', 'Could not save your data.');
    }
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading your money data…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Personal money app</Text>
          <Text style={styles.title}>Money at a glance</Text>
          <Text style={styles.subtitle}>Offline-first MVP with local persistence on this device.</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current balance</Text>
          <Text style={styles.balanceValue}>{money(totals.balance)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Income</Text>
              <Text style={styles.balancePillValue}>{money(totals.income)}</Text>
            </View>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Expenses</Text>
              <Text style={styles.balancePillValue}>{money(totals.expenses)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budgets</Text>
          <Text style={styles.sectionNote}>Monthly limits</Text>
        </View>
        <View style={styles.card}>
          {budgetStats.map((budget) => (
            <View key={budget.category} style={styles.progressItem}>
              <View style={styles.progressTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{budget.category}</Text>
                  <Text style={styles.rowMeta}>
                    {money(budget.spent)} of {money(budget.limit)}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: progressColor(budget.pct) }]}>{budget.pct}%</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, budget.pct)}%`, backgroundColor: progressColor(budget.pct) },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <Pressable style={styles.smallButton} onPress={() => addQuickGoalContribution('Emergency fund', 25)}>
            <Text style={styles.smallButtonText}>+ $25 to Emergency</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {goalStats.map((goal) => (
            <View key={goal.name} style={styles.progressItem}>
              <View style={styles.progressTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{goal.name}</Text>
                  <Text style={styles.rowMeta}>
                    {money(goal.saved)} saved of {money(goal.target)}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: progressColor(goal.pct) }]}>{goal.pct}%</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, goal.pct)}%`, backgroundColor: progressColor(goal.pct) },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recurring bills</Text>
          <Pressable style={styles.smallButton} onPress={addBill}>
            <Text style={styles.smallButtonText}>Add bill</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {bills.map((bill) => (
            <View key={`${bill.name}-${bill.dueDay}-${bill.category}`} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{bill.name}</Text>
                <Text style={styles.rowMeta}>
                  Due day {bill.dueDay} • {bill.category}
                </Text>
              </View>
              <Text style={styles.rowValue}>{money(bill.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Pressable style={styles.button} onPress={openNewTransaction}>
            <Text style={styles.buttonText}>Add</Text>
          </Pressable>
        </View>

        <TextInput
          placeholder="Search transactions"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.card}>
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.emptyText}>No transactions match your search.</Text>}
            renderItem={({ item }) => (
              <View style={styles.txRow}>
                <Pressable style={{ flex: 1 }} onPress={() => openEditTransaction(item)}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>
                    {item.category} • {item.date}
                  </Text>
                </Pressable>
                <View style={styles.txActions}>
                  <Text style={[styles.rowValue, item.type === 'income' ? styles.income : styles.expense]}>
                    {item.type === 'income' ? '+' : '-'}
                    {money(item.amount)}
                  </Text>
                  <Pressable onPress={() => deleteTransaction(item.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>

        <Pressable style={styles.exportButton} onPress={exportData}>
          <Text style={styles.exportButtonText}>Save local backup</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit transaction' : 'Add transaction'}</Text>
            <TextInput
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholderTextColor="#64748b"
            />
            <TextInput
              placeholder="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholderTextColor="#64748b"
            />
            <TextInput
              placeholder="Category"
              value={category}
              onChangeText={setCategory}
              style={styles.input}
              placeholderTextColor="#64748b"
            />

            <View style={styles.toggleRow}>
              <Pressable style={[styles.toggle, type === 'expense' && styles.toggleActive]} onPress={() => setType('expense')}>
                <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
              </Pressable>
              <Pressable style={[styles.toggle, type === 'income' && styles.toggleActive]} onPress={() => setType('income')}>
                <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>Income</Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={[styles.button, styles.buttonGhost]} onPress={resetModal}>
                <Text style={[styles.buttonText, styles.buttonGhostText]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={addOrUpdateTransaction}>
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f172a' },
  loadingWrap: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: '#cbd5e1', fontSize: 16 },
  container: { padding: 20, gap: 18, backgroundColor: '#0f172a' },
  header: { gap: 6 },
  kicker: { color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#cbd5e1', fontSize: 15, lineHeight: 21 },
  balanceCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 18, gap: 14 },
  balanceLabel: { color: '#94a3b8', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 34, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', gap: 10 },
  balancePill: { flex: 1, backgroundColor: '#0f172a', padding: 12, borderRadius: 14 },
  balancePillLabel: { color: '#94a3b8', fontSize: 12 },
  balancePillValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  sectionNote: { color: '#94a3b8', fontSize: 13 },
  card: { backgroundColor: '#111827', borderRadius: 18, padding: 16, gap: 12 },
  rowTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  rowMeta: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  rowValue: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  income: { color: '#4ade80' },
  expense: { color: '#f87171' },
  separator: { height: 1, backgroundColor: '#1f2937' },
  button: { backgroundColor: '#38bdf8', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { color: '#082f49', fontWeight: '800' },
  buttonGhost: { backgroundColor: '#1f2937' },
  buttonGhostText: { color: '#e2e8f0' },
  smallButton: { backgroundColor: '#1f2937', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  smallButtonText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  progressItem: { gap: 8 },
  progressTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBarBackground: { height: 10, borderRadius: 999, backgroundColor: '#1f2937', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999 },
  searchInput: { backgroundColor: '#1e293b', color: '#fff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  txActions: { alignItems: 'flex-end', gap: 6 },
  deleteText: { color: '#fca5a5', fontWeight: '700', fontSize: 12 },
  emptyText: { color: '#94a3b8', textAlign: 'center', paddingVertical: 8 },
  exportButton: { backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  exportButtonText: { color: '#052e16', fontWeight: '900', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f172a', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  input: { backgroundColor: '#1e293b', color: '#fff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: { flex: 1, borderWidth: 1, borderColor: '#334155', padding: 12, borderRadius: 12, alignItems: 'center' },
  toggleActive: { backgroundColor: '#e2e8f0', borderColor: '#e2e8f0' },
  toggleText: { color: '#cbd5e1', fontWeight: '700' },
  toggleTextActive: { color: '#0f172a' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
