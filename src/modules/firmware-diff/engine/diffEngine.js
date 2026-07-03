/**
 * Myers/LCS text diff algorithm, Intel HEX parser, BIN statistics, ELF parser, and Binary diff engine.
 */

// ─── TEXT DIFF ENGINE ────────────────────────────────────────────────────────

/**
 * Computes the Longest Common Subsequence (LCS) to align lines between A and B.
 */
export function computeLineDiff(linesA, linesB) {
  const m = linesA.length;
  const n = linesB.length;
  
  // Use DP to find LCS size
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the alignment
  let i = m;
  let j = n;
  const alignment = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      alignment.unshift({
        type: 'UNCHANGED',
        value: linesA[i - 1],
        lineA: i,
        lineB: j
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      alignment.unshift({
        type: 'ADDED',
        value: linesB[j - 1],
        lineA: null,
        lineB: j
      });
      j--;
    } else {
      alignment.unshift({
        type: 'REMOVED',
        value: linesA[i - 1],
        lineA: i,
        lineB: null
      });
      i--;
    }
  }

  // Detect MODIFIED lines by matching adjacent REMOVED and ADDED lines
  const finalDiff = [];
  let idx = 0;
  while (idx < alignment.length) {
    const current = alignment[idx];
    
    if (current.type === 'REMOVED') {
      // Find subsequent removals
      const removals = [current];
      let rIdx = idx + 1;
      while (rIdx < alignment.length && alignment[rIdx].type === 'REMOVED') {
        removals.push(alignment[rIdx]);
        rIdx++;
      }

      // Find subsequent additions immediately after the removals
      const additions = [];
      let aIdx = rIdx;
      while (aIdx < alignment.length && alignment[aIdx].type === 'ADDED') {
        additions.push(alignment[aIdx]);
        aIdx++;
      }

      if (additions.length > 0) {
        // We have a block of removals followed by a block of additions.
        // Match them up.
        const maxMatch = Math.min(removals.length, additions.length);
        const matchedRemovals = new Set();
        const matchedAdditions = new Set();

        for (let r = 0; r < removals.length; r++) {
          const rem = removals[r];
          let bestAddIdx = -1;
          let bestRatio = -1;

          for (let a = 0; a < additions.length; a++) {
            if (matchedAdditions.has(a)) continue;
            const add = additions[a];
            const ratio = levenshteinRatio(rem.value, add.value);
            if (ratio > 0.60 && ratio > bestRatio) {
              bestRatio = ratio;
              bestAddIdx = a;
            }
          }

          if (bestAddIdx !== -1) {
            matchedRemovals.add(r);
            matchedAdditions.add(bestAddIdx);
            
            const add = additions[bestAddIdx];
            const { charDiffA, charDiffB } = computeCharDiff(rem.value, add.value);

            finalDiff.push({
              type: 'MODIFIED',
              valueA: rem.value,
              valueB: add.value,
              lineA: rem.lineA,
              lineB: add.lineB,
              charDiffA,
              charDiffB
            });
          }
        }

        // Add remaining unmatched removals and additions
        for (let r = 0; r < removals.length; r++) {
          if (!matchedRemovals.has(r)) {
            finalDiff.push(removals[r]);
          }
        }

        // We jump the index to aIdx, but we must account for additions that were not matched.
        // Those additions will be handled since we jump past the matched block,
        // but any additions not matched need to be pushed.
        for (let a = 0; a < additions.length; a++) {
          if (!matchedAdditions.has(a)) {
            finalDiff.push(additions[a]);
          }
        }

        idx = aIdx;
      } else {
        finalDiff.push(current);
        idx++;
      }
    } else {
      finalDiff.push(current);
      idx++;
    }
  }

  return finalDiff;
}

/**
 * Calculates Levenshtein ratio between s1 and s2.
 */
export function levenshteinRatio(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const dp = Array.from({ length: len1 + 1 }, () => new Int32Array(len2 + 1));
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  const dist = dp[len1][len2];
  return (maxLen - dist) / maxLen;
}

/**
 * Computes character-level diff between modified line versions.
 */
function computeCharDiff(strA, strB) {
  const m = strA.length;
  const n = strB.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (strA[i - 1] === strB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const charDiffA = [];
  const charDiffB = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && strA[i - 1] === strB[j - 1]) {
      charDiffA.unshift({ type: 'UNCHANGED', char: strA[i - 1] });
      charDiffB.unshift({ type: 'UNCHANGED', char: strB[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      charDiffB.unshift({ type: 'ADDED', char: strB[j - 1] });
      j--;
    } else {
      charDiffA.unshift({ type: 'REMOVED', char: strA[i - 1] });
      i--;
    }
  }

  return { charDiffA, charDiffB };
}

/**
 * Groups diff lines into context hunks.
 */
export function generateHunks(diffLines, contextCount = 3) {
  const hunks = [];
  let currentHunk = null;

  for (let idx = 0; idx < diffLines.length; idx++) {
    const line = diffLines[idx];
    const isChange = line.type !== 'UNCHANGED';

    if (isChange) {
      if (!currentHunk) {
        // Start a new hunk
        const startIdx = Math.max(0, idx - contextCount);
        const contextA = [];
        const contextB = [];
        
        for (let c = startIdx; c < idx; c++) {
          contextA.push(diffLines[c]);
          contextB.push(diffLines[c]);
        }

        currentHunk = {
          startA: contextA[0]?.lineA || line.lineA || 1,
          startB: contextB[0]?.lineB || line.lineB || 1,
          linesA: contextA,
          linesB: contextB,
          context: 'unknown'
        };
      }

      // Add the changed line
      if (line.type === 'REMOVED') {
        currentHunk.linesA.push(line);
      } else if (line.type === 'ADDED') {
        currentHunk.linesB.push(line);
      } else if (line.type === 'MODIFIED') {
        currentHunk.linesA.push({ ...line, type: 'REMOVED', value: line.valueA, charDiff: line.charDiffA });
        currentHunk.linesB.push({ ...line, type: 'ADDED', value: line.valueB, charDiff: line.charDiffB });
      }
    } else {
      if (currentHunk) {
        // We are in context after a change
        // Check if there is another change within the window (2 * contextCount)
        let hasNextChange = false;
        for (let next = idx; next < Math.min(diffLines.length, idx + contextCount * 2); next++) {
          if (diffLines[next].type !== 'UNCHANGED') {
            hasNextChange = true;
            break;
          }
        }

        if (hasNextChange) {
          // Merge next context lines into current hunk
          currentHunk.linesA.push(line);
          currentHunk.linesB.push(line);
        } else {
          // Fill context lines up to contextCount and close hunk
          for (let c = 0; c < contextCount; c++) {
            if (idx + c < diffLines.length && diffLines[idx + c].type === 'UNCHANGED') {
              currentHunk.linesA.push(diffLines[idx + c]);
              currentHunk.linesB.push(diffLines[idx + c]);
            }
          }
          hunks.push(currentHunk);
          currentHunk = null;
          idx += contextCount - 1; // Skip ahead
        }
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // Resolve hunk context header/configuration/functions
  hunks.forEach((hunk) => {
    let codeStr = hunk.linesA.map(l => l.value || l.valueA || '').join('\n');
    if (codeStr.includes('#include') || codeStr.includes('import ') || codeStr.includes('#define')) {
      hunk.context = 'header';
    } else if (codeStr.includes('const ') || codeStr.includes('config') || codeStr.includes('{') && codeStr.includes(':')) {
      hunk.context = 'config';
    } else if (codeStr.includes('void ') || codeStr.includes('def ') || codeStr.includes('function') || codeStr.includes('fn ')) {
      hunk.context = 'function_body';
    } else {
      hunk.context = 'unknown';
    }
  });

  return hunks;
}

/**
 * Calculates statistics across text diffs.
 */
export function calculateStats(diffLines) {
  let added = 0;
  let removed = 0;
  let modified = 0;
  let totalLines = 0;

  diffLines.forEach((line) => {
    if (line.type === 'ADDED') added++;
    else if (line.type === 'REMOVED') removed++;
    else if (line.type === 'MODIFIED') modified++;
    if (line.lineA !== null) totalLines++;
  });

  const changes = added + removed + modified * 2;
  const percentChanged = totalLines > 0 ? Math.min(100, Math.round((changes / (totalLines * 2)) * 100)) : 0;

  // Scan functions affected
  const functionsAffected = [];
  let currentFunc = 'Global';
  const cFuncRegex = /^\s*(?:void|int|float|double|char|bool|auto|fn)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
  const pyFuncRegex = /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;

  diffLines.forEach((line) => {
    const val = line.value || line.valueA || line.valueB || '';
    
    // Check if line defines function
    const match = val.match(cFuncRegex) || val.match(pyFuncRegex);
    if (match) {
      currentFunc = match[1];
    }

    if (line.type !== 'UNCHANGED' && !functionsAffected.includes(currentFunc)) {
      functionsAffected.push(currentFunc);
    }
  });

  return {
    linesAdded: added,
    linesRemoved: removed,
    linesModified: modified,
    percentChanged,
    functionsAffected
  };
}

// ─── INTEL HEX PARSER ────────────────────────────────────────────────────────

/**
 * Parses Intel HEX line records.
 */
export function parseIntelHex(hexText) {
  const lines = hexText.split('\n');
  const bytes = [];
  let baseAddress = 0;
  let entryPoint = null;
  let validRecords = 0;
  let invalidRecords = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith(':')) return;

    const dataLen = parseInt(trimmed.slice(1, 3), 16);
    const offset = parseInt(trimmed.slice(3, 7), 16);
    const type = parseInt(trimmed.slice(7, 9), 16);
    const dataHex = trimmed.slice(9, 9 + dataLen * 2);
    const checksum = parseInt(trimmed.slice(9 + dataLen * 2, 11 + dataLen * 2), 16);

    // Validate checksum
    let sum = dataLen + (offset >> 8) + (offset & 0xff) + type;
    for (let i = 0; i < dataLen; i++) {
      sum += parseInt(dataHex.slice(i * 2, i * 2 + 2), 16);
    }
    const computedChecksum = (0x100 - (sum & 0xff)) & 0xff;
    const isValid = computedChecksum === checksum;

    if (isValid) {
      validRecords++;
    } else {
      invalidRecords++;
    }

    if (type === 0x00) {
      // Data Record
      const actualAddress = baseAddress + offset;
      for (let i = 0; i < dataLen; i++) {
        const val = parseInt(dataHex.slice(i * 2, i * 2 + 2), 16);
        bytes[actualAddress + i] = val;
      }
    } else if (type === 0x02) {
      // Extended Segment Address
      baseAddress = parseInt(dataHex, 16) << 4;
    } else if (type === 0x04) {
      // Extended Linear Address
      baseAddress = parseInt(dataHex, 16) << 16;
    } else if (type === 0x05 || type === 0x03) {
      // Start Linear Address (Entry Point)
      entryPoint = parseInt(dataHex, 16);
    }
  });

  // Extract address map ranges
  const addressRanges = [];
  let currentRange = null;

  for (let addr = 0; addr < bytes.length; addr++) {
    if (bytes[addr] !== undefined) {
      if (!currentRange) {
        currentRange = { start: addr, end: addr };
      } else {
        currentRange.end = addr;
      }
    } else {
      if (currentRange) {
        addressRanges.push(currentRange);
        currentRange = null;
      }
    }
  }
  if (currentRange) {
    addressRanges.push(currentRange);
  }

  // Generate Hex Dump formatted representation (compact size, max 16KB dump)
  let hexDumpText = '';
  const totalSize = addressRanges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
  
  let linesWritten = 0;
  addressRanges.forEach((range) => {
    let start = range.start - (range.start % 16);
    for (let addr = start; addr <= range.end; addr += 16) {
      if (linesWritten > 1024) { // Truncate at ~16KB of text dump
        hexDumpText += '... [HEX DUMP TRUNCATED FOR SIZE] ...\n';
        break;
      }
      
      let addrHex = addr.toString(16).toUpperCase().padStart(8, '0');
      let bytesHex = '';
      let ascii = '';

      for (let i = 0; i < 16; i++) {
        const b = bytes[addr + i];
        if (b !== undefined) {
          bytesHex += b.toString(16).toUpperCase().padStart(2, '0') + ' ';
          ascii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
        } else {
          bytesHex += '   ';
          ascii += ' ';
        }
      }
      hexDumpText += `${addrHex}: ${bytesHex} | ${ascii}\n`;
      linesWritten++;
    }
  });

  return {
    bytes: new Uint8Array(bytes.filter(b => b !== undefined)),
    fullAddressBytes: bytes,
    addressRanges,
    totalSize,
    entryPoint: entryPoint !== null ? '0x' + entryPoint.toString(16).toUpperCase() : 'N/A',
    checksumValid: invalidRecords === 0 && validRecords > 0,
    hexDumpText,
    type: 'HEX'
  };
}

// ─── BIN STATISTICS ANALYZER ────────────────────────────────────────────────

/**
 * Calculates byte entropy and statistics for BIN buffers.
 */
export function analyzeBin(binBuffer) {
  const len = binBuffer.length;
  const frequencies = new Int32Array(256);
  
  for (let i = 0; i < len; i++) {
    frequencies[binBuffer[i]]++;
  }

  // Shannon Entropy: H = -sum(p_i * log2(p_i))
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const p = frequencies[i] / len;
      entropy -= p * Math.log2(p);
    }
  }

  // Format first 8KB of hex dump
  let hexDumpText = '';
  const maxDump = Math.min(8192, len);
  for (let addr = 0; addr < maxDump; addr += 16) {
    let addrHex = addr.toString(16).toUpperCase().padStart(8, '0');
    let bytesHex = '';
    let ascii = '';

    for (let i = 0; i < 16; i++) {
      if (addr + i < len) {
        const b = binBuffer[addr + i];
        bytesHex += b.toString(16).toUpperCase().padStart(2, '0') + ' ';
        ascii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
      } else {
        bytesHex += '   ';
        ascii += ' ';
      }
    }
    hexDumpText += `${addrHex}: ${bytesHex} | ${ascii}\n`;
  }
  if (len > maxDump) {
    hexDumpText += `... [TRUNCATED ${len - maxDump} BYTES] ...\n`;
  }

  return {
    bytes: binBuffer,
    totalSize: len,
    entropy: entropy.toFixed(4),
    frequencies: Array.from(frequencies),
    hexDumpText,
    type: 'BIN'
  };
}

// ─── ELF HEADER PARSER ───────────────────────────────────────────────────────

/**
 * Parses basic ELF structures.
 */
export function parseElf(elfBuffer) {
  const len = elfBuffer.length;
  if (len < 52 || elfBuffer[0] !== 0x7f || elfBuffer[1] !== 0x45 || elfBuffer[2] !== 0x4c || elfBuffer[3] !== 0x46) {
    return { error: 'Invalid ELF Magic signature', type: 'ELF' };
  }

  const is64 = elfBuffer[4] === 2; // Class: 1 = 32-bit, 2 = 64-bit
  const isLE = elfBuffer[5] === 1; // Endianness: 1 = Little, 2 = Big

  const read16 = (offset) => {
    if (isLE) return elfBuffer[offset] | (elfBuffer[offset + 1] << 8);
    return (elfBuffer[offset] << 8) | elfBuffer[offset + 1];
  };

  const read32 = (offset) => {
    if (isLE) {
      return (
        elfBuffer[offset] |
        (elfBuffer[offset + 1] << 8) |
        (elfBuffer[offset + 2] << 16) |
        (elfBuffer[offset + 3] << 24)
      );
    }
    return (
      (elfBuffer[offset] << 24) |
      (elfBuffer[offset + 1] << 16) |
      (elfBuffer[offset + 2] << 8) |
      elfBuffer[offset + 3]
    );
  };

  const read64 = (offset) => {
    // Return Hex representation for 64-bit to prevent precision losses in JS numbers
    const parts = [];
    if (isLE) {
      for (let i = 7; i >= 0; i--) {
        parts.push(elfBuffer[offset + i].toString(16).padStart(2, '0'));
      }
    } else {
      for (let i = 0; i < 8; i++) {
        parts.push(elfBuffer[offset + i].toString(16).padStart(2, '0'));
      }
    }
    return '0x' + parts.join('').toUpperCase().replace(/^0+/, '');
  };

  // Extract Entry point
  let entryPoint = '';
  if (is64) {
    entryPoint = read64(24);
  } else {
    entryPoint = '0x' + read32(24).toString(16).toUpperCase();
  }

  // Machine Target
  const machineVal = read16(18);
  const machines = {
    0x03: 'x86 (Intel 80386)',
    0x28: 'ARM (32-bit)',
    0x3E: 'AMD64 (x86_64)',
    0xB7: 'AArch64 (ARM 64-bit)',
    0xF3: 'RISC-V'
  };
  const architecture = machines[machineVal] || `Unknown (0x${machineVal.toString(16).toUpperCase()})`;

  // Parse Section details (simplified section headers lookup)
  const shoff = is64 ? read64(40) : read32(32);
  const shnum = is64 ? read16(60) : read16(48);
  const shentsize = is64 ? read16(58) : read16(46);

  const sections = [];
  // Parse section list if offset is a valid number and sections aren't corrupted
  const shoffNum = typeof shoff === 'string' ? parseInt(shoff, 16) : shoff;

  if (shoffNum > 0 && shoffNum + shnum * shentsize <= len) {
    for (let s = 0; s < Math.min(shnum, 64); s++) {
      const offset = shoffNum + s * shentsize;
      const type = read32(offset + 4);
      const addr = is64 ? read64(offset + 16) : '0x' + read32(offset + 12).toString(16).toUpperCase();
      const size = is64 ? read64(offset + 32) : read32(offset + 20);

      // Section types map
      const types = ['SHT_NULL', 'SHT_PROGBITS', 'SHT_SYMTAB', 'SHT_STRTAB', 'SHT_RELA', 'SHT_HASH', 'SHT_DYNAMIC', 'SHT_NOTE', 'SHT_NOBITS', 'SHT_REL', 'SHT_SHLIB', 'SHT_DYNSYM'];
      sections.push({
        index: s,
        type: types[type] || `SHT_OTHER (${type})`,
        address: addr,
        size: typeof size === 'string' ? size : `${size} bytes`
      });
    }
  }

  return {
    totalSize: len,
    entryPoint,
    is64: is64 ? '64-bit' : '32-bit',
    endianness: isLE ? 'Little Endian' : 'Big Endian',
    architecture,
    sections,
    type: 'ELF'
  };
}

// ─── BINARY BYTE-LEVEL DIFF ──────────────────────────────────────────────────

/**
 * Compares two binary buffers and highlights byte differences.
 */
export function diffBinary(bytesA, bytesB) {
  const len = Math.max(bytesA.length, bytesB.length);
  const changes = [];
  
  let currentChange = null;

  for (let i = 0; i < len; i++) {
    const byteA = bytesA[i];
    const byteB = bytesB[i];
    const mismatch = byteA !== byteB;

    if (mismatch) {
      if (!currentChange) {
        currentChange = { start: i, end: i, bytesA: [byteA], bytesB: [byteB] };
      } else {
        currentChange.end = i;
        currentChange.bytesA.push(byteA);
        currentChange.bytesB.push(byteB);
      }
    } else {
      if (currentChange) {
        changes.push(currentChange);
        currentChange = null;
      }
    }
  }
  if (currentChange) {
    changes.push(currentChange);
  }

  // Format delta hunks representation
  let diffDumpText = '';
  let linesWritten = 0;

  changes.forEach((change) => {
    if (linesWritten > 256) return; // Cap output size

    const size = change.end - change.start + 1;
    diffDumpText += `Address Block 0x${change.start.toString(16).toUpperCase()} - 0x${change.end.toString(16).toUpperCase()} (${size} bytes changed):\n`;

    // Dump side by side bytes in chunks of 8
    for (let offset = 0; offset < size; offset += 8) {
      let chunkAddr = (change.start + offset).toString(16).toUpperCase().padStart(8, '0');
      let dumpA = '';
      let dumpB = '';

      for (let i = 0; i < 8; i++) {
        if (offset + i < size) {
          const bA = change.bytesA[offset + i];
          const bB = change.bytesB[offset + i];
          
          const aStr = bA === undefined ? '  ' : bA.toString(16).toUpperCase().padStart(2, '0');
          const bStr = bB === undefined ? '  ' : bB.toString(16).toUpperCase().padStart(2, '0');

          dumpA += aStr + ' ';
          dumpB += bStr + ' ';
        }
      }
      diffDumpText += `  ${chunkAddr}  [Before]: ${dumpA.padEnd(25)} | [After]: ${dumpB}\n`;
      linesWritten++;
    }
    diffDumpText += '\n';
  });

  if (changes.length === 0) {
    diffDumpText = 'Binaries are identical.';
  }

  return {
    changesCount: changes.length,
    changedBytesTotal: changes.reduce((sum, c) => sum + (c.end - c.start + 1), 0),
    diffDumpText,
    regions: changes.map(c => ({ start: c.start, end: c.end, length: c.end - c.start + 1 }))
  };
}
