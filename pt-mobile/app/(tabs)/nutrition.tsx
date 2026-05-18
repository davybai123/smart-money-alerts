import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, subDays } from 'date-fns';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { MacroBar } from '@/components/ui/MacroBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MealSection, MEAL_ORDER } from '@/components/nutrition/MealSection';
import { getMacroColor } from '@/lib/nutrition';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { MealType, FoodItem } from '@/types';
import { searchFood } from '@/lib/openfoodfacts';

export default function NutritionScreen() {
  const router = useRouter();
  const { profile, user } = useAuthStore();
  const {
    logs,
    selectedDate,
    setDate,
    fetchLogs,
    addLog,
    deleteLog,
    waterLitres,
    setWater,
    getTotals,
    isLoading,
  } = useNutritionStore();

  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('breakfast');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState('100');

  const totals = getTotals();
  const calorieGoal = profile?.daily_calorie_target || 2500;
  const proteinGoal = profile?.protein_target || 180;
  const carbsGoal = profile?.carbs_target || 250;
  const fatGoal = profile?.fat_target || 80;

  const loadLogs = useCallback(async () => {
    if (user) await fetchLogs(user.id, selectedDate);
  }, [user, selectedDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const changeDate = (delta: number) => {
    const current = new Date(selectedDate);
    const newDate = delta > 0 ? addDays(current, 1) : subDays(current, 1);
    setDate(format(newDate, 'yyyy-MM-dd'));
  };

  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  const handleAddFood = (meal: MealType) => {
    setSelectedMeal(meal);
    setAddModalVisible(true);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setQuantity('100');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchFood(searchQuery.trim());
      setSearchResults(results);
    } catch {
      Alert.alert('Error', 'Failed to search foods. Check your connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    setQuantity(String(food.serving_size));
  };

  const handleLogFood = async () => {
    if (!selectedFood || !user) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid quantity');
      return;
    }

    const factor = qty / selectedFood.serving_size;
    await addLog({
      user_id: user.id,
      date: selectedDate,
      meal: selectedMeal,
      food_name: selectedFood.name,
      brand: selectedFood.brand,
      barcode: selectedFood.barcode,
      calories: Math.round(selectedFood.calories * factor),
      protein: Math.round(selectedFood.protein * factor * 10) / 10,
      carbs: Math.round(selectedFood.carbs * factor * 10) / 10,
      fat: Math.round(selectedFood.fat * factor * 10) / 10,
      fiber: selectedFood.fiber ? Math.round(selectedFood.fiber * factor * 10) / 10 : undefined,
      quantity: qty,
      serving_unit: selectedFood.serving_unit,
    });

    setAddModalVisible(false);
  };

  const getMealLogs = (meal: MealType) => logs.filter((l) => l.meal === meal);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nutrition</Text>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push('/scan')}
        >
          <Ionicons name="scan-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      <View style={styles.datePicker}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>
            {isToday ? 'Today' : format(new Date(selectedDate), 'EEEE')}
          </Text>
          <Text style={styles.dateSubText}>
            {format(new Date(selectedDate), 'MMMM d, yyyy')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => changeDate(1)}
          style={styles.dateArrow}
          disabled={isToday}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isToday ? Colors.textDim : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Calorie Summary */}
        <Card>
          <View style={styles.calorieSummary}>
            <View style={styles.calorieStat}>
              <Text style={styles.calorieStatValue}>{calorieGoal}</Text>
              <Text style={styles.calorieStatLabel}>Goal</Text>
            </View>
            <View style={styles.calorieMain}>
              <Text style={styles.calorieConsumed}>{Math.round(totals.calories)}</Text>
              <Text style={styles.calorieLabel}>kcal eaten</Text>
            </View>
            <View style={styles.calorieStat}>
              <Text style={[styles.calorieStatValue, { color: Colors.accent }]}>
                {Math.max(0, calorieGoal - Math.round(totals.calories))}
              </Text>
              <Text style={styles.calorieStatLabel}>Remaining</Text>
            </View>
          </View>
        </Card>

        {/* Macro Bars */}
        <Card style={styles.macroCard}>
          <Text style={styles.sectionLabel}>Macros</Text>
          <View style={styles.macroBars}>
            <MacroBar
              label="Protein"
              current={totals.protein}
              target={proteinGoal}
              color={getMacroColor('protein')}
            />
            <MacroBar
              label="Carbohydrates"
              current={totals.carbs}
              target={carbsGoal}
              color={getMacroColor('carbs')}
            />
            <MacroBar
              label="Fat"
              current={totals.fat}
              target={fatGoal}
              color={getMacroColor('fat')}
            />
          </View>
        </Card>

        {/* Water */}
        <Card>
          <View style={styles.waterRow}>
            <Text style={styles.sectionLabel}>💧 Water</Text>
            <Text style={[styles.waterValue, { color: Colors.info }]}>
              {waterLitres.toFixed(1)} L
            </Text>
          </View>
          <View style={styles.waterBtns}>
            {[0.25, 0.33, 0.5, 1.0].map((amt) => (
              <TouchableOpacity
                key={amt}
                style={styles.waterBtn}
                onPress={() => setWater(Math.min(6, waterLitres + amt))}
              >
                <Ionicons name="water-outline" size={14} color={Colors.info} />
                <Text style={styles.waterBtnText}>+{amt}L</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Meal Sections */}
        <Text style={styles.sectionLabel}>Meals</Text>
        {isLoading ? (
          <ActivityIndicator color={Colors.accent} />
        ) : (
          <View style={styles.mealList}>
            {MEAL_ORDER.map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                logs={getMealLogs(meal)}
                onDelete={deleteLog}
                onAdd={handleAddFood}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Food Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Add to{' '}
                {selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1).replace('_', ' ')}
              </Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedFood ? (
              // Food detail / quantity
              <View style={styles.foodDetail}>
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => setSelectedFood(null)}
                >
                  <Ionicons name="arrow-back" size={18} color={Colors.accent} />
                  <Text style={styles.backLinkText}>Back to search</Text>
                </TouchableOpacity>
                <Card style={styles.selectedFoodCard}>
                  <Text style={styles.selectedFoodName}>{selectedFood.name}</Text>
                  {selectedFood.brand && (
                    <Text style={styles.selectedFoodBrand}>{selectedFood.brand}</Text>
                  )}
                  <View style={styles.foodMacros}>
                    <MacroChipSmall label="Cal" value={Math.round(selectedFood.calories)} unit="kcal" />
                    <MacroChipSmall label="P" value={selectedFood.protein} unit="g" />
                    <MacroChipSmall label="C" value={selectedFood.carbs} unit="g" />
                    <MacroChipSmall label="F" value={selectedFood.fat} unit="g" />
                  </View>
                  <Text style={styles.servingHint}>Per {selectedFood.serving_size}{selectedFood.serving_unit}</Text>
                </Card>
                <View style={styles.quantityRow}>
                  <Text style={styles.quantityLabel}>Quantity ({selectedFood.serving_unit})</Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholder="100"
                    placeholderTextColor={Colors.textDim}
                  />
                </View>
                <Button
                  label="Add to Log"
                  onPress={handleLogFood}
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="add-circle" size={18} color={Colors.black} />}
                />
              </View>
            ) : (
              // Search
              <View style={styles.searchContainer}>
                <View style={styles.searchRow}>
                  <View style={styles.searchInput}>
                    <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                    <TextInput
                      style={styles.searchField}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search food..."
                      placeholderTextColor={Colors.textDim}
                      returnKeyType="search"
                      onSubmitEditing={handleSearch}
                      autoFocus
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                        <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Button label="Search" onPress={handleSearch} loading={searching} size="sm" />
                </View>

                {/* Scan shortcut */}
                <TouchableOpacity
                  style={styles.scanShortcut}
                  onPress={() => {
                    setAddModalVisible(false);
                    router.push('/scan');
                  }}
                >
                  <Ionicons name="scan-outline" size={18} color={Colors.info} />
                  <Text style={styles.scanShortcutText}>Scan barcode instead</Text>
                </TouchableOpacity>

                {searching ? (
                  <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing['2xl'] }} />
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item, i) => item.barcode || `${item.name}-${i}`}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.resultItem}
                        onPress={() => handleSelectFood(item)}
                      >
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                          {item.brand && <Text style={styles.resultBrand}>{item.brand}</Text>}
                        </View>
                        <View style={styles.resultMacros}>
                          <Text style={styles.resultCalories}>{item.calories} kcal</Text>
                          <Text style={styles.resultServing}>/{item.serving_size}{item.serving_unit}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    ListEmptyComponent={
                      searchResults.length === 0 && !searching && searchQuery.length > 0 ? (
                        <Text style={styles.noResults}>No results found. Try a different search term.</Text>
                      ) : null
                    }
                    style={styles.resultList}
                    keyboardShouldPersistTaps="handled"
                  />
                )}
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function MacroChipSmall({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.label}>{label}</Text>
      <Text style={chipStyles.value}>{Math.round(value)}{unit}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  label: { fontSize: FontSize.xs, color: Colors.textMuted },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.text },
  scanBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateArrow: { padding: Spacing.sm },
  dateCenter: { alignItems: 'center' },
  dateText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  dateSubText: { fontSize: FontSize.xs, color: Colors.textMuted },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  calorieSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calorieStat: { alignItems: 'center', gap: 2 },
  calorieStatValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  calorieStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  calorieMain: { alignItems: 'center' },
  calorieConsumed: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.black,
    color: Colors.text,
  },
  calorieLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  macroCard: { gap: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  macroBars: { gap: Spacing.lg },
  waterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  waterValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  waterBtns: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  waterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.infoMuted,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  waterBtnText: { fontSize: FontSize.xs, color: Colors.info, fontWeight: FontWeight.semibold },
  mealList: { gap: Spacing.md },
  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  searchContainer: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchField: { flex: 1, color: Colors.text, fontSize: FontSize.base },
  scanShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  scanShortcutText: { fontSize: FontSize.sm, color: Colors.info },
  resultList: { flex: 1 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.medium },
  resultBrand: { fontSize: FontSize.xs, color: Colors.textMuted },
  resultMacros: { alignItems: 'flex-end' },
  resultCalories: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.warning },
  resultServing: { fontSize: FontSize.xs, color: Colors.textDim },
  separator: { height: 1, backgroundColor: Colors.border },
  noResults: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing['3xl'], fontSize: FontSize.base },
  // Food detail
  foodDetail: { flex: 1, padding: Spacing.lg, gap: Spacing.lg },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  backLinkText: { fontSize: FontSize.sm, color: Colors.accent },
  selectedFoodCard: { gap: Spacing.sm },
  selectedFoodName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  selectedFoodBrand: { fontSize: FontSize.sm, color: Colors.textMuted },
  foodMacros: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  servingHint: { fontSize: FontSize.xs, color: Colors.textDim },
  quantityRow: { gap: Spacing.sm },
  quantityLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text },
  quantityInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'center',
  },
});
