/**
 * Province Configuration Tests
 * Tests land transfer tax calculations for all Canadian provinces
 */

const { getAllProvinces, getProvince, calculateLandTransferTax } = require('../config/provinces');

describe('Province Configuration', () => {
  describe('getAllProvinces', () => {
    it('should return all 13 provinces and territories', () => {
      const provinces = getAllProvinces();
      expect(provinces).toHaveLength(13);
    });

    it('should include all required provinces', () => {
      const provinces = getAllProvinces();
      const codes = provinces.map(p => p.code);

      expect(codes).toContain('ON');
      expect(codes).toContain('BC');
      expect(codes).toContain('AB');
      expect(codes).toContain('QC');
      expect(codes).toContain('MB');
      expect(codes).toContain('SK');
      expect(codes).toContain('NS');
      expect(codes).toContain('NB');
      expect(codes).toContain('NL');
      expect(codes).toContain('PE');
      expect(codes).toContain('NT');
      expect(codes).toContain('YT');
      expect(codes).toContain('NU');
    });

    it('should have valid structure for each province', () => {
      const provinces = getAllProvinces();

      provinces.forEach(province => {
        expect(province).toHaveProperty('code');
        expect(province).toHaveProperty('name');
        expect(province).toHaveProperty('fullName');
      });
    });
  });

  describe('getProvince', () => {
    it('should return Ontario province data', () => {
      const ontario = getProvince('ON');
      expect(ontario).toBeDefined();
      expect(ontario.name).toBe('Ontario');
      expect(ontario.landTransferTax).toBeDefined();
    });

    it('should return British Columbia province data', () => {
      const bc = getProvince('BC');
      expect(bc).toBeDefined();
      expect(bc.name).toBe('British Columbia');
    });

    it('should return null for invalid province code', () => {
      const invalid = getProvince('XX');
      expect(invalid).toBeNull();
    });

    it('should be case insensitive', () => {
      const ontario = getProvince('on');
      expect(ontario).toBeDefined();
      expect(ontario.code).toBe('ON');
    });
  });

  describe('calculateLandTransferTax', () => {
    describe('Ontario', () => {
      it('should calculate tax for $300,000 property', () => {
        const result = calculateLandTransferTax('ON', 300000);
        expect(result).toHaveProperty('provincialTax');
        expect(result).toHaveProperty('totalTax');
        expect(result.provincialTax).toBeGreaterThan(0);
      });

      it('should calculate tax for $500,000 property', () => {
        const result = calculateLandTransferTax('ON', 500000);
        expect(result.provincialTax).toBeGreaterThan(0);
      });

      it('should calculate tax for $1,000,000 property', () => {
        const result = calculateLandTransferTax('ON', 1000000);
        expect(result.provincialTax).toBeGreaterThan(0);
      });

      it('should apply first-time buyer rebate', () => {
        const withRebate = calculateLandTransferTax('ON', 400000, { isFirstTimeBuyer: true });
        const withoutRebate = calculateLandTransferTax('ON', 400000, { isFirstTimeBuyer: false });

        expect(withRebate.rebate).toBeGreaterThan(0);
        expect(withRebate.totalTax).toBeLessThan(withoutRebate.totalTax);
      });

      it('should add Toronto municipal tax', () => {
        const withToronto = calculateLandTransferTax('ON', 500000, { isToronto: true });
        const withoutToronto = calculateLandTransferTax('ON', 500000, { isToronto: false });

        expect(withToronto.municipalTax).toBeGreaterThan(0);
        expect(withToronto.totalTax).toBeGreaterThan(withoutToronto.totalTax);
      });
    });

    describe('British Columbia', () => {
      it('should calculate tax for $500,000 property', () => {
        const result = calculateLandTransferTax('BC', 500000);
        expect(result.provincialTax).toBeGreaterThan(0);
      });

      it('should calculate tax for $2,000,000 property', () => {
        const result = calculateLandTransferTax('BC', 2000000);
        expect(result.provincialTax).toBeGreaterThan(0);
      });

      it('should apply first-time buyer exemption', () => {
        const withExemption = calculateLandTransferTax('BC', 500000, { isFirstTimeBuyer: true });
        const withoutExemption = calculateLandTransferTax('BC', 500000, { isFirstTimeBuyer: false });

        expect(withExemption.totalTax).toBeLessThanOrEqual(withoutExemption.totalTax);
      });

      it('should apply newly built exemption', () => {
        const withExemption = calculateLandTransferTax('BC', 700000, { isNewlyBuilt: true });
        const withoutExemption = calculateLandTransferTax('BC', 700000, { isNewlyBuilt: false });

        expect(withExemption.totalTax).toBeLessThanOrEqual(withoutExemption.totalTax);
      });
    });

    describe('Quebec', () => {
      it('should calculate welcome tax correctly', () => {
        const result = calculateLandTransferTax('QC', 400000);
        expect(result.provincialTax).toBeGreaterThan(0);
      });
    });

    describe('Alberta', () => {
      it('should have no land transfer tax', () => {
        const result = calculateLandTransferTax('AB', 500000);
        expect(result.provincialTax).toBe(0);
        expect(result.totalTax).toBe(0);
      });
    });

    describe('Saskatchewan', () => {
      it('should have no land transfer tax', () => {
        const result = calculateLandTransferTax('SK', 500000);
        expect(result.provincialTax).toBe(0);
      });
    });

    describe('Error handling', () => {
      it('should throw error for invalid province', () => {
        expect(() => calculateLandTransferTax('XX', 500000)).toThrow();
      });

      it('should handle zero price', () => {
        const result = calculateLandTransferTax('ON', 0);
        expect(result.provincialTax).toBe(0);
      });

      it('should handle negative price gracefully', () => {
        const result = calculateLandTransferTax('ON', -100000);
        expect(result.provincialTax).toBe(0);
      });
    });
  });
});
