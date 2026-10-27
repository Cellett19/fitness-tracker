import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
  } from 'react';
  
  import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
  } from 'react-native';
  
  const API_URL =
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
  
  const IMAGE_BASE_URL =
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
  
  const PURPLE = '#7C5CFC';
  
  export type LibraryExercise = {
    exerciseId: string;
    name: string;
    gifUrl: string;
    targetMuscles: string[];
    bodyParts: string[];
    equipments: string[];
    secondaryMuscles: string[];
    instructions: string[];
  };
  
  let cachedExercises: LibraryExercise[] | null = null;
  
  const BODY_FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'Chest', value: 'chest' },
    { label: 'Back', value: 'back' },
    { label: 'Shoulders', value: 'shoulders' },
    { label: 'Arms', value: 'arms' },
    { label: 'Legs', value: 'legs' },
    { label: 'Glutes', value: 'glutes' },
    { label: 'Abs', value: 'waist' },
    { label: 'Cardio', value: 'cardio' },
  ];
  
  const normalise = (value: string) =>
    value.toLowerCase().replace(/[_-]/g, ' ').trim();
  
  const formatLabel = (value: string) =>
    value
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  
  const toStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .filter((item) => item != null)
        .map((item) => String(item));
    }
  
    if (typeof value === 'string' && value.trim()) {
      return [value];
    }
  
    return [];
  };
  
  const getBodyParts = (exercise: LibraryExercise) =>
    (exercise.bodyParts ?? []).map(normalise);
  
  const getEquipment = (exercise: LibraryExercise) =>
    (exercise.equipments ?? []).map(normalise);
  
  const mapExercise = (item: any): LibraryExercise | null => {
    const id = String(item.id ?? item.exerciseId ?? '').trim();
  
    if (!id) return null;
  
    const primaryMuscles = toStringArray(
      item.primaryMuscles ?? item.targetMuscles,
    );
  
    const secondaryMuscles = toStringArray(
      item.secondaryMuscles,
    );
  
    const rawImages = toStringArray(item.images);

    const imagePath = rawImages[0] ?? '';
  
    const imageUrl = imagePath
      ? `${IMAGE_BASE_URL}${imagePath
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')}`
      : '';
  
    return {
      exerciseId: id,
      name: String(item.name ?? 'Unnamed exercise'),
      gifUrl: imageUrl,
      targetMuscles: primaryMuscles,
      bodyParts: primaryMuscles,
      equipments: toStringArray(item.equipment),
      secondaryMuscles,
      instructions: toStringArray(item.instructions),
    };
  };
  
  const extractItems = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.exercises)) return payload.exercises;
    if (Array.isArray(payload.results)) return payload.results;
  
    return [];
  };
  
  const belongsToBodyFilter = (
    exercise: LibraryExercise,
    filter: string,
  ) => {
    if (filter === 'all') return true;
  
    const muscles = [
      ...getBodyParts(exercise),
      ...(exercise.targetMuscles ?? []).map(normalise),
      ...(exercise.secondaryMuscles ?? []).map(normalise),
    ];
  
    if (filter === 'arms') {
      return muscles.some((item) =>
        [
          'biceps',
          'triceps',
          'forearms',
          'upper arms',
          'lower arms',
        ].includes(item),
      );
    }
  
    if (filter === 'legs') {
      return muscles.some((item) =>
        [
          'quadriceps',
          'quads',
          'hamstrings',
          'calves',
          'adductors',
          'abductors',
          'shins',
        ].includes(item),
      );
    }
  
    if (filter === 'glutes') {
      return muscles.some((item) => item.includes('glute'));
    }
  
    if (filter === 'shoulders') {
      return muscles.some((item) =>
        [
          'shoulders',
          'delts',
          'deltoids',
        ].includes(item),
      );
    }
  
    if (filter === 'waist') {
      return muscles.some((item) =>
        [
          'abdominals',
          'abs',
          'obliques',
          'waist',
        ].includes(item),
      );
    }
  
    if (filter === 'cardio') {
      return muscles.some((item) =>
        ['cardio', 'cardiovascular'].includes(item),
      );
    }
  
    return muscles.some(
      (item) => item === filter || item.includes(filter),
    );
  };
  
  type Props = {
    onBack: () => void;
    onSelect: (exercise: LibraryExercise) => void;
    selectedNames: string[];
  };
  
  export default function ExercisePickerScreen({
    onBack,
    onSelect,
    selectedNames,
  }: Props) {
    const [exercises, setExercises] = useState<LibraryExercise[]>(
      cachedExercises ?? [],
    );
  
    const [loading, setLoading] = useState(!cachedExercises);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [bodyFilter, setBodyFilter] = useState('all');
    const [equipmentFilter, setEquipmentFilter] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'muscle'>('name');
    const [details, setDetails] = useState<LibraryExercise | null>(null);
  
    const loadExercises = useCallback(
      async (forceRefresh = false) => {
        if (cachedExercises && !forceRefresh) {
          setExercises(cachedExercises);
          setError('');
          setLoading(false);
          return;
        }
  
        setLoading(true);
        setError('');
  
        try {
          console.log(
            'Loading Free Exercise DB catalogue:',
            API_URL,
          );
  
          const response = await fetch(API_URL, {
            headers: {
              Accept: 'application/json',
            },
          });
  
          if (!response.ok) {
            throw new Error(
              `Exercise catalogue returned HTTP ${response.status}. Please try again.`,
            );
          }
  
          const payload = await response.json();
          const rawItems = extractItems(payload);
  
          console.log('Free Exercise DB response:', {
            status: response.status,
            received: rawItems.length,
            firstExercise: rawItems[0]?.name ?? null,
            lastExercise:
              rawItems[rawItems.length - 1]?.name ?? null,
          });
  
          if (rawItems.length === 0) {
            throw new Error(
              'The exercise catalogue returned no records. Check your connection and try again.',
            );
          }
  
          const mapped = rawItems
            .map(mapExercise)
            .filter(
              (item): item is LibraryExercise => item !== null,
            );
  
          const uniqueExercises = Array.from(
            new Map(
              mapped.map((exercise) => [
                exercise.exerciseId,
                exercise,
              ]),
            ).values(),
          );
  
          if (uniqueExercises.length === 0) {
            throw new Error(
              'The exercise data was received, but no usable exercise records were found.',
            );
          }
  
          cachedExercises = uniqueExercises;
          setExercises(uniqueExercises);
  
          console.log(
            `Exercise library loaded: ${uniqueExercises.length} unique exercises.`,
          );
        } catch (err) {
          console.error(
            'Failed to load Free Exercise DB:',
            err,
          );
  
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load the exercise catalogue. Please try again.',
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );
  
    useEffect(() => {
      void loadExercises();
    }, [loadExercises]);
  
    const equipmentOptions = useMemo(() => {
      const allEquipment = exercises.flatMap(getEquipment);
  
      return [...new Set(allEquipment)].sort((a, b) =>
        a.localeCompare(b),
      );
    }, [exercises]);
  
    const filteredExercises = useMemo(() => {
      const query = normalise(search);
  
      return exercises
        .filter((exercise) => {
          const searchable = [
            exercise.name,
            ...exercise.bodyParts,
            ...exercise.targetMuscles,
            ...exercise.secondaryMuscles,
            ...exercise.equipments,
            ...exercise.instructions,
          ]
            .join(' ')
            .toLowerCase();
  
          const matchesSearch =
            !query || normalise(searchable).includes(query);
  
          const matchesBody = belongsToBodyFilter(
            exercise,
            bodyFilter,
          );
  
          const matchesEquipment =
            equipmentFilter === 'all' ||
            getEquipment(exercise).includes(equipmentFilter);
  
          return (
            matchesSearch &&
            matchesBody &&
            matchesEquipment
          );
        })
        .sort((a, b) => {
          if (sortBy === 'muscle') {
            const aMuscle =
              a.targetMuscles[0] ?? '';
  
            const bMuscle =
              b.targetMuscles[0] ?? '';
  
            const muscleOrder = aMuscle.localeCompare(bMuscle);
  
            if (muscleOrder !== 0) return muscleOrder;
          }
  
          return a.name.localeCompare(b.name);
        });
    }, [
      exercises,
      search,
      bodyFilter,
      equipmentFilter,
      sortBy,
    ]);
  
    const selectedSet = useMemo(
      () => new Set(selectedNames.map(normalise)),
      [selectedNames],
    );
  
    const renderChips = (
      items: { label: string; value: string }[],
      selected: string,
      onChoose: (value: string) => void,
    ) => (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {items.map((item) => {
          const active = selected === item.value;
  
          return (
            <Pressable
              key={item.value}
              style={[
                styles.chip,
                active && styles.activeChip,
              ]}
              onPress={() => onChoose(item.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.activeChipText,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  
    const selectExercise = (exercise: LibraryExercise) => {
      if (selectedSet.has(normalise(exercise.name))) return;
  
      setDetails(null);
      onSelect(exercise);
    };
  
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={styles.backButton}
            onPress={onBack}
          >
            <Text style={styles.backText}>
              ‹ Back to routine
            </Text>
          </Pressable>
  
          <Text style={styles.title}>Exercise Library</Text>
  
          <Text style={styles.subtitle}>
            Search exercises, choose a muscle group, and add
            movements to your routine.
          </Text>
  
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
  
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercise, muscle or equipment"
              placeholderTextColor="#777777"
              style={styles.searchInput}
              autoCapitalize="none"
              returnKeyType="search"
            />
  
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Text style={styles.clearSearch}>×</Text>
              </Pressable>
            )}
          </View>
  
          <Text style={styles.filterTitle}>BODY PART</Text>
  
          {renderChips(
            BODY_FILTERS,
            bodyFilter,
            setBodyFilter,
          )}
  
          <Text style={styles.filterTitle}>EQUIPMENT</Text>
  
          {renderChips(
            [
              { label: 'All equipment', value: 'all' },
              ...equipmentOptions.map((item) => ({
                label: formatLabel(item),
                value: item,
              })),
            ],
            equipmentFilter,
            setEquipmentFilter,
          )}
  
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              {loading
                ? 'Loading exercises…'
                : `${filteredExercises.length} exercises`}
            </Text>
  
            <Pressable
              style={styles.sortButton}
              onPress={() =>
                setSortBy((previous) =>
                  previous === 'name' ? 'muscle' : 'name',
                )
              }
            >
              <Text style={styles.sortText}>
                Sort: {sortBy === 'name' ? 'Name A–Z' : 'Muscle'}
              </Text>
            </Pressable>
          </View>
  
          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator
                size="large"
                color={PURPLE}
              />
  
              <Text style={styles.mutedText}>
                Fetching the exercise library…
              </Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.emptyTitle}>
                Could not load exercises
              </Text>
  
              <Text style={styles.mutedText}>{error}</Text>
  
              <Pressable
                style={styles.primaryButton}
                onPress={() => void loadExercises(true)}
              >
                <Text style={styles.primaryButtonText}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : filteredExercises.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.emptyTitle}>
                No matching exercises
              </Text>
  
              <Text style={styles.mutedText}>
                Try another search or change your filters.
              </Text>
            </View>
          ) : (
            filteredExercises.map((exercise) => {
              const alreadyAdded = selectedSet.has(
                normalise(exercise.name),
              );
  
              const bodyLabel =
                exercise.bodyParts
                  .map(formatLabel)
                  .join(', ') || 'Other';
  
              const muscleLabel =
                exercise.targetMuscles
                  .map(formatLabel)
                  .join(', ') || 'Muscle not specified';
  
              const equipmentLabel =
                exercise.equipments
                  .map(formatLabel)
                  .join(', ') || 'Equipment not specified';
  
              return (
                <View
                  key={exercise.exerciseId}
                  style={styles.exerciseCard}
                >
                  <Pressable
                    style={styles.exerciseMain}
                    onPress={() => setDetails(exercise)}
                  >
                    {exercise.gifUrl ? (
                      <Image
                        source={{ uri: exercise.gifUrl }}
                        style={styles.thumbnail}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        style={[
                          styles.thumbnail,
                          styles.imagePlaceholder,
                        ]}
                      >
                        <Text style={styles.placeholderIcon}>
                          🏋️
                        </Text>
                      </View>
                    )}
  
                    <View style={styles.exerciseInfo}>
                      <Text
                        style={styles.exerciseName}
                        numberOfLines={2}
                      >
                        {formatLabel(exercise.name)}
                      </Text>
  
                      <Text
                        style={styles.muscleText}
                        numberOfLines={1}
                      >
                        {muscleLabel}
                      </Text>
  
                      <Text
                        style={styles.equipmentText}
                        numberOfLines={1}
                      >
                        {equipmentLabel}
                      </Text>
  
                      <Text style={styles.bodyTag}>
                        {bodyLabel}
                      </Text>
                    </View>
                  </Pressable>
  
                  <Pressable
                    style={[
                      styles.addButton,
                      alreadyAdded && styles.addedButton,
                    ]}
                    disabled={alreadyAdded}
                    onPress={() => selectExercise(exercise)}
                  >
                    <Text
                      style={[
                        styles.addButtonText,
                        alreadyAdded && styles.addedButtonText,
                      ]}
                    >
                      {alreadyAdded ? 'Added' : '+ Add'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
  
          <Text style={styles.attribution}>
            Exercise data and images: Free Exercise DB
          </Text>
        </ScrollView>
  
        <Modal
          visible={details !== null}
          animationType="slide"
          transparent
          onRequestClose={() => setDetails(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  style={styles.modalClose}
                  onPress={() => setDetails(null)}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
  
                {details?.gifUrl ? (
                  <Image
                    source={{ uri: details.gifUrl }}
                    style={styles.detailImage}
                    resizeMode="contain"
                  />
                ) : null}
  
                <Text style={styles.detailTitle}>
                  {details ? formatLabel(details.name) : ''}
                </Text>
  
                <Text style={styles.detailLabel}>
                  PRIMARY MUSCLES
                </Text>
  
                <Text style={styles.detailValue}>
                  {details?.targetMuscles
                    .map(formatLabel)
                    .join(', ') || 'Not specified'}
                </Text>
  
                <Text style={styles.detailLabel}>
                  SECONDARY MUSCLES
                </Text>
  
                <Text style={styles.detailValue}>
                  {details?.secondaryMuscles
                    .map(formatLabel)
                    .join(', ') || 'Not specified'}
                </Text>
  
                <Text style={styles.detailLabel}>
                  EQUIPMENT
                </Text>
  
                <Text style={styles.detailValue}>
                  {details?.equipments
                    .map(formatLabel)
                    .join(', ') || 'Not specified'}
                </Text>
  
                <Text style={styles.detailLabel}>
                  INSTRUCTIONS
                </Text>
  
                {(details?.instructions ?? []).map(
                  (instruction, index) => (
                    <Text
                      key={`${index}-${instruction}`}
                      style={styles.instruction}
                    >
                      {index + 1}. {instruction}
                    </Text>
                  ),
                )}
  
                {details && (
                  <Pressable
                    style={[
                      styles.primaryButton,
                      selectedSet.has(normalise(details.name)) &&
                        styles.addedButton,
                    ]}
                    disabled={selectedSet.has(
                      normalise(details.name),
                    )}
                    onPress={() => selectExercise(details)}
                  >
                    <Text style={styles.primaryButtonText}>
                      {selectedSet.has(normalise(details.name))
                        ? 'Already in routine'
                        : '＋ Add to routine'}
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#111111',
    },
  
    content: {
      padding: 20,
      paddingTop: 65,
      paddingBottom: 50,
    },
  
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
      marginBottom: 14,
    },
  
    backText: {
      color: '#b5a0ff',
      fontSize: 15,
      fontWeight: '600',
    },
  
    title: {
      color: '#ffffff',
      fontSize: 29,
      fontWeight: '700',
    },
  
    subtitle: {
      color: '#888888',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
      marginBottom: 18,
    },
  
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1c1c1e',
      borderWidth: 1,
      borderColor: '#38383c',
      borderRadius: 12,
      paddingHorizontal: 12,
      marginBottom: 18,
    },
  
    searchIcon: {
      color: '#b5a0ff',
      fontSize: 25,
      marginRight: 8,
    },
  
    searchInput: {
      flex: 1,
      color: '#ffffff',
      fontSize: 14,
      paddingVertical: 14,
    },
  
    clearSearch: {
      color: '#aaaaaa',
      fontSize: 23,
      paddingLeft: 8,
    },
  
    filterTitle: {
      color: '#999999',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      marginBottom: 9,
      marginTop: 4,
    },
  
    chipRow: {
      gap: 8,
      paddingBottom: 16,
    },
  
    chip: {
      backgroundColor: '#202023',
      borderWidth: 1,
      borderColor: '#38383c',
      borderRadius: 20,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
  
    activeChip: {
      backgroundColor: '#30264d',
      borderColor: PURPLE,
    },
  
    chipText: {
      color: '#bbbbbb',
      fontSize: 12,
      fontWeight: '600',
    },
  
    activeChipText: {
      color: '#d7ceff',
    },
  
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 12,
    },
  
    resultsTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
  
    sortButton: {
      backgroundColor: '#242426',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
  
    sortText: {
      color: '#c9baff',
      fontSize: 12,
      fontWeight: '600',
    },
  
    exerciseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1c1c1e',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#303034',
      padding: 10,
      marginBottom: 10,
      gap: 10,
    },
  
    exerciseMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
  
    thumbnail: {
      width: 88,
      height: 92,
      borderRadius: 10,
      backgroundColor: '#f2f2f2',
    },
  
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  
    placeholderIcon: {
      fontSize: 28,
    },
  
    exerciseInfo: {
      flex: 1,
      minWidth: 0,
    },
  
    exerciseName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
  
    muscleText: {
      color: '#c9baff',
      fontSize: 11,
      marginTop: 5,
    },
  
    equipmentText: {
      color: '#aaaaaa',
      fontSize: 11,
      marginTop: 3,
    },
  
    bodyTag: {
      color: '#72d6a0',
      fontSize: 10,
      marginTop: 5,
    },
  
    addButton: {
      backgroundColor: PURPLE,
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
  
    addButtonText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
    },
  
    addedButton: {
      backgroundColor: '#253b30',
    },
  
    addedButtonText: {
      color: '#72d6a0',
    },
  
    stateCard: {
      backgroundColor: '#1c1c1e',
      borderRadius: 14,
      padding: 20,
      alignItems: 'center',
      gap: 12,
    },
  
    emptyTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
  
    mutedText: {
      color: '#888888',
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
  
    primaryButton: {
      backgroundColor: PURPLE,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      alignItems: 'center',
      marginTop: 14,
      marginBottom: 10,
    },
  
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
  
    attribution: {
      color: '#777777',
      fontSize: 10,
      lineHeight: 15,
      textAlign: 'center',
      marginTop: 18,
      marginBottom: 8,
    },
  
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
  
    modalCard: {
      backgroundColor: '#1c1c1e',
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: 20,
      paddingBottom: 30,
      maxHeight: '88%',
      borderWidth: 1,
      borderColor: '#38383c',
    },
  
    modalClose: {
      alignSelf: 'flex-end',
      paddingHorizontal: 8,
      paddingBottom: 4,
    },
  
    modalCloseText: {
      color: '#ffffff',
      fontSize: 30,
    },
  
    detailImage: {
      width: '100%',
      height: 220,
      backgroundColor: '#f2f2f2',
      borderRadius: 14,
      marginBottom: 16,
    },
  
    detailTitle: {
      color: '#ffffff',
      fontSize: 23,
      fontWeight: '700',
      marginBottom: 14,
    },
  
    detailLabel: {
      color: '#b5a0ff',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 13,
      marginBottom: 5,
    },
  
    detailValue: {
      color: '#eeeeee',
      fontSize: 14,
      lineHeight: 20,
    },
  
    instruction: {
      color: '#cccccc',
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 8,
    },
  });