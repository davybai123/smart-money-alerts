import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { fetchProductByBarcode } from '@/lib/openfoodfacts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { FoodItem, MealType } from '@/types';
import { format } from 'date-fns';

const MEAL_OPTIONS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: '🌅 Breakfast' },
  { key: 'lunch', label: '☀️ Lunch' },
  { key: 'dinner', label: '🌙 Dinner' },
  { key: 'snack', label: '🍎 Snack' },
  { key: 'pre_workout', label: '⚡ Pre-Workout' },
  { key: 'post_workout', label: '💪 Post-Workout' },
];

export default function ScanScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addLog, selectedDate } = useNutritionStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [foundProduct, setFoundProduct] = useState<FoodItem | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('snack');
  const [quantity, setQuantity] = useState('100');
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const handleBarcodeScan = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned || loading) return;

      setScanned(true);
      setLoading(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      try {
        const product = await fetchProductByBarcode(data);
        if (product) {
          setFoundProduct(product);
          setQuantity(String(product.serving_size));
        } else {
          Alert.alert(
            'Product Not Found',
            `Barcode: ${data}\n\nThis product isn't in the OpenFoodFacts database. Try searching manually.`,
            [
              { text: 'Scan Again', onPress: () => setScanned(false) },
              { text: 'Go Back', onPress: () => router.back() },
            ]
          );
        }
      } catch {
        Alert.alert('Error', 'Failed to fetch product. Check your internet connection.', [
          { text: 'Scan Again', onPress: () => setScanned(false) },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [scanned, loading, router]
  );

  const handleAddToLog = async () => {
    if (!foundProduct || !user) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid quantity.');
      return;
    }

    const factor = qty / foundProduct.serving_size;
    const logDate = selectedDate || format(new Date(), 'yyyy-MM-dd');

    await addLog({
      user_id: user.id,
      date: logDate,
      meal: selectedMeal,
      food_name: foundProduct.name,
      brand: foundProduct.brand,
      barcode: foundProduct.barcode,
      calories: Math.round(foundProduct.calories * factor),
      protein: Math.round(foundProduct.protein * factor * 10) / 10,
      carbs: Math.round(foundProduct.carbs * factor * 10) / 10,
      fat: Math.round(foundProduct.fat * factor * 10) / 10,
      fiber: foundProduct.fiber
        ? Math.round(foundProduct.fiber * factor * 10) / 10
        : undefined,
      quantity: qty,
      serving_unit: foundProduct.serving_unit,
    });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Added! ✅',
      `${foundProduct.name} logged to ${selectedMeal.replace('_', ' ')}`,
      [
        { text: 'Scan Another', onPress: () => { setFoundProduct(null); setScanned(false); } },
        { text: 'Done', onPress: () => router.back() },
      ]
    );
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionDesc}>
            We need camera access to scan food barcodes and log nutrition automatically.
          </Text>
          <Button
            label="Grant Camera Access"
            onPress={requestPermission}
            fullWidth
            size="lg"
          />
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
        enableTorch={torchOn}
      />

      {/* Overlay */}
      <SafeAreaView style={styles.overlay}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.overlayBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Scan Barcode</Text>
          <TouchableOpacity
            style={[styles.overlayBtn, torchOn && styles.overlayBtnActive]}
            onPress={() => setTorchOn((v) => !v)}
          >
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Viewfinder */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            {/* Corner marks */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={Colors.accent} size="large" />
                <Text style={styles.loadingText}>Looking up product...</Text>
              </View>
            )}
          </View>
          <Text style={styles.scanHint}>
            {loading ? 'Fetching product data...' : 'Point at barcode to scan'}
          </Text>
        </View>

        {/* Bottom area — product result or instructions */}
        <View style={styles.bottomArea}>
          {foundProduct ? (
            <Card style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{foundProduct.name}</Text>
                  {foundProduct.brand && (
                    <Text style={styles.productBrand}>{foundProduct.brand}</Text>
                  )}
                </View>
                <View style={styles.productCalories}>
                  <Text style={[styles.calorieValue, { color: Colors.warning }]}>
                    {foundProduct.calories}
                  </Text>
                  <Text style={styles.calorieUnit}>kcal</Text>
                </View>
              </View>

              <View style={styles.macroRow}>
                <MacroChip label="Protein" value={foundProduct.protein} color={Colors.accent} />
                <MacroChip label="Carbs" value={foundProduct.carbs} color={Colors.info} />
                <MacroChip label="Fat" value={foundProduct.fat} color={Colors.danger} />
                {foundProduct.fiber !== undefined && (
                  <MacroChip label="Fiber" value={foundProduct.fiber} color={Colors.purple} />
                )}
              </View>
              <Text style={styles.servingNote}>
                Per {foundProduct.serving_size}{foundProduct.serving_unit}
              </Text>

              {/* Quantity & Meal */}
              <View style={styles.logControls}>
                <View style={styles.quantityControl}>
                  <Text style={styles.controlLabel}>Quantity ({foundProduct.serving_unit})</Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholderTextColor={Colors.textDim}
                  />
                </View>
                <View style={styles.mealControl}>
                  <Text style={styles.controlLabel}>Meal</Text>
                  <TouchableOpacity
                    style={styles.mealSelector}
                    onPress={() => setMealModalVisible(true)}
                  >
                    <Text style={styles.mealSelectorText}>
                      {MEAL_OPTIONS.find((m) => m.key === selectedMeal)?.label}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.actionBtns}>
                <Button
                  label="Add to Log"
                  onPress={handleAddToLog}
                  fullWidth
                  icon={<Ionicons name="add-circle" size={18} color={Colors.black} />}
                />
                <TouchableOpacity
                  style={styles.rescanBtn}
                  onPress={() => { setFoundProduct(null); setScanned(false); }}
                >
                  <Ionicons name="scan-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.rescanText}>Scan another</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : (
            <View style={styles.instructionRow}>
              <View style={styles.instructionItem}>
                <Ionicons name="barcode-outline" size={22} color={Colors.textMuted} />
                <Text style={styles.instructionText}>EAN-13 / UPC</Text>
              </View>
              <View style={styles.instructionItem}>
                <Ionicons name="flash-outline" size={22} color={Colors.textMuted} />
                <Text style={styles.instructionText}>Good lighting</Text>
              </View>
              <View style={styles.instructionItem}>
                <Ionicons name="scan-outline" size={22} color={Colors.textMuted} />
                <Text style={styles.instructionText}>Hold steady</Text>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Meal Picker Modal */}
      <Modal
        visible={mealModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMealModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.mealModalOverlay}
          activeOpacity={1}
          onPress={() => setMealModalVisible(false)}
        >
          <View style={styles.mealModalContent}>
            <Text style={styles.mealModalTitle}>Select Meal</Text>
            {MEAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.mealOption,
                  selectedMeal === opt.key && styles.mealOptionSelected,
                ]}
                onPress={() => { setSelectedMeal(opt.key); setMealModalVisible(false); }}
              >
                <Text style={[
                  styles.mealOptionText,
                  selectedMeal === opt.key && styles.mealOptionTextSelected,
                ]}>
                  {opt.label}
                </Text>
                {selectedMeal === opt.key && (
                  <Ionicons name="checkmark" size={18} color={Colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={chipStyles.chip}>
      <Text style={[chipStyles.value, { color }]}>{Math.round(value * 10) / 10}g</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
  },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  label: { fontSize: FontSize.xs, color: Colors.textMuted },
});

const CORNER_SIZE = 24;
const CORNER_BORDER = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  overlayBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtnActive: { backgroundColor: Colors.accentMuted },
  overlayTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  viewfinderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['2xl'],
  },
  viewfinder: {
    width: 260,
    height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.accent,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderBottomRightRadius: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.lg,
  },
  loadingText: { color: Colors.white, fontSize: FontSize.sm },
  scanHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  bottomArea: {
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  productCard: { gap: Spacing.md },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  productBrand: { fontSize: FontSize.xs, color: Colors.textMuted },
  productCalories: { alignItems: 'center' },
  calorieValue: { fontSize: FontSize.xl, fontWeight: FontWeight.black },
  calorieUnit: { fontSize: FontSize.xs, color: Colors.textMuted },
  macroRow: { flexDirection: 'row', gap: Spacing.sm },
  servingNote: { fontSize: FontSize.xs, color: Colors.textDim },
  logControls: { flexDirection: 'row', gap: Spacing.md },
  quantityControl: { flex: 1, gap: Spacing.xs },
  mealControl: { flex: 1, gap: Spacing.xs },
  controlLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  quantityInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.base,
    textAlign: 'center',
  },
  mealSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  mealSelectorText: { fontSize: FontSize.xs, color: Colors.text },
  actionBtns: { gap: Spacing.sm },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  rescanText: { fontSize: FontSize.sm, color: Colors.textMuted },
  instructionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing['3xl'],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  instructionItem: { alignItems: 'center', gap: Spacing.xs },
  instructionText: { fontSize: FontSize.xs, color: Colors.textMuted },
  // Permission screen
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  permissionIcon: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  permissionTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  cancelBtn: { padding: Spacing.md },
  cancelText: { fontSize: FontSize.base, color: Colors.textMuted },
  // Meal modal
  mealModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  mealModalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    gap: Spacing.xs,
    paddingBottom: Spacing['4xl'],
  },
  mealModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  mealOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  mealOptionSelected: { backgroundColor: Colors.accentMuted },
  mealOptionText: { fontSize: FontSize.base, color: Colors.text },
  mealOptionTextSelected: { color: Colors.accent, fontWeight: FontWeight.semibold },
});
