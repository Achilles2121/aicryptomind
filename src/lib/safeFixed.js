// Copyright (c) 2025 Vision AI Mind. All rights reserved.
export const safeFixed = (val, digits = 2) => (Number(val) || 0).toFixed(digits);
