// Subject ID mapping helper for server
export const getSubjectNumericId = (subjectStringId: string): number => {
  const mapping: Record<string, number> = {
    "MATH_001": 1,
    "LIT_001": 2, 
    "ENG_001": 3,
    "HIS_001": 4,
    "GEO_001": 5,
    "BIO_001": 6,
    "PHY_001": 7,
    "CHE_001": 8
  };
  return mapping[subjectStringId] || 1;
};

export const getSubjectStringId = (subjectNumericId: number): string => {
  const mapping: Record<number, string> = {
    1: "MATH_001",
    2: "LIT_001",
    3: "ENG_001", 
    4: "HIS_001",
    5: "GEO_001",
    6: "BIO_001",
    7: "PHY_001",
    8: "CHE_001"
  };
  return mapping[subjectNumericId] || "MATH_001";
};