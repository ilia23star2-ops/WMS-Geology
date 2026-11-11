/// Алгоритм Левенштейна для нечеткого поиска (Fuzzy Search).
/// Помогает исправлять ошибки OCR, сравнивая текст с базой данных.
int levenshtein(String a, String b) {
  if (a == b) return 0;
  if (a.isEmpty) return b.length;
  if (b.isEmpty) return a.length;

  final v0 = List<int>.filled(b.length + 1, 0);
  final v1 = List<int>.filled(b.length + 1, 0);

  for (int i = 0; i < v0.length; i++) {
    v0[i] = i;
  }

  for (int i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (int j = 0; j < b.length; j++) {
      final cost = (a[i] == b[j]) ? 0 : 1;
      v1[j + 1] = [
        v1[j] + 1, // удаление
        v0[j + 1] + 1, // вставка
        v0[j] + cost, // замена
      ].reduce((min, val) => val < min ? val : min);
    }
    for (int j = 0; j < v0.length; j++) {
      v0[j] = v1[j];
    }
  }
  return v1[b.length];
}
