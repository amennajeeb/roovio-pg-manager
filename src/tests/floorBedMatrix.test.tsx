import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { FloorBedMatrixOverview } from '../components/dashboard/FloorBedMatrixOverview';
import { Room, Floor, Bed, Tenant } from '../types';

describe('FloorBedMatrixOverview Component Tests', () => {
  const mockFloors: Floor[] = [
    { id: 'floor-1', propertyId: 'prop-1', number: 1, name: 'Floor 1 (Ground)' },
    { id: 'floor-2', propertyId: 'prop-1', number: 2, name: 'Floor 2' },
  ];

  const mockRooms: Room[] = [
    {
      id: 'room-101',
      floorId: 'floor-1',
      propertyId: 'prop-1',
      roomNumber: '101',
      sharingType: 'single',
      hasAc: true,
      hasAttachedBathroom: true,
      hasBalcony: false,
      standardRent: 6500,
      beds: [
        {
          id: 'b-101-1',
          roomId: 'room-101',
          label: 'Single Bed 1',
          bedType: 'single',
          tier: 'single',
          monthlyRent: 6500,
          status: 'occupied',
          currentTenantId: 'tenant-1',
        },
      ],
    },
    {
      id: 'room-102',
      floorId: 'floor-1',
      propertyId: 'prop-1',
      roomNumber: '102',
      sharingType: 'double',
      hasAc: true,
      hasAttachedBathroom: true,
      hasBalcony: true,
      standardRent: 5500,
      beds: [
        {
          id: 'b-102-1',
          roomId: 'room-102',
          label: 'Bunk 1 - Lower',
          bedType: 'bunk',
          bunkGroup: 'Bunk 1',
          tier: 'lower',
          monthlyRent: 5500,
          status: 'occupied',
          currentTenantId: 'tenant-2',
        },
        {
          id: 'b-102-2',
          roomId: 'room-102',
          label: 'Bunk 1 - Upper',
          bedType: 'bunk',
          bunkGroup: 'Bunk 1',
          tier: 'upper',
          monthlyRent: 5000,
          status: 'vacant',
        },
      ],
    },
    {
      id: 'room-201',
      floorId: 'floor-2',
      propertyId: 'prop-1',
      roomNumber: '201',
      sharingType: 'triple',
      hasAc: false,
      hasAttachedBathroom: false,
      hasBalcony: false,
      standardRent: 4500,
      beds: [
        {
          id: 'b-201-1',
          roomId: 'room-201',
          label: 'Bunk 1 - Lower',
          bedType: 'bunk',
          bunkGroup: 'Bunk 1',
          tier: 'lower',
          monthlyRent: 4500,
          status: 'vacant',
        },
        {
          id: 'b-201-2',
          roomId: 'room-201',
          label: 'Bunk 1 - Upper',
          bedType: 'bunk',
          bunkGroup: 'Bunk 1',
          tier: 'upper',
          monthlyRent: 4200,
          status: 'vacant',
        },
        {
          id: 'b-201-3',
          roomId: 'room-201',
          label: 'Single Bed 1',
          bedType: 'single',
          tier: 'single',
          monthlyRent: 4500,
          status: 'vacant',
        },
      ],
    },
    {
      id: 'room-202',
      floorId: 'floor-2',
      propertyId: 'prop-1',
      roomNumber: '202',
      sharingType: 'single',
      hasAc: false,
      hasAttachedBathroom: false,
      hasBalcony: false,
      roomPurpose: 'storage',
      operationalStatus: 'storage',
      beds: [],
    },
  ];

  const mockTenants: Tenant[] = [
    {
      id: 'tenant-1',
      propertyId: 'prop-1',
      roomId: 'room-101',
      bedId: 'b-101-1',
      name: 'Muhammed Niyas',
      phone: '9847123456',
      isPhoneMasked: false,
      status: 'active',
      monthlyRent: 6500,
      monthlyDueDay: 5,
      depositRequired: 13000,
      depositReceived: 13000,
      joiningDate: '2026-01-01',
      assignedInventory: [],
      stayHistory: [],
      whatsappLogs: [],
    },
    {
      id: 'tenant-2',
      propertyId: 'prop-1',
      roomId: 'room-102',
      bedId: 'b-102-1',
      name: 'Arjun Raj',
      phone: '9847234567',
      isPhoneMasked: false,
      status: 'active',
      monthlyRent: 5500,
      monthlyDueDay: 5,
      depositRequired: 11000,
      depositReceived: 11000,
      joiningDate: '2026-02-01',
      assignedInventory: [],
      stayHistory: [],
      whatsappLogs: [],
    },
  ];

  const renderComponent = () => {
    const raw = renderToString(
      <MemoryRouter>
        <FloorBedMatrixOverview
          rooms={mockRooms}
          floors={mockFloors}
          tenants={mockTenants}
        />
      </MemoryRouter>
    );
    return raw.replace(/<!-- -->/g, '');
  };

  it('renders the overview header with complete statistics', () => {
    const html = renderComponent();
    expect(html).toContain('Floor &amp; Bed Matrix Overview');
    expect(html).toContain('4 Rooms');
    expect(html).toContain('6 Berths');
    expect(html).toContain('across 2 Floors');
  });

  it('renders full, complete floor names without truncating Floor 1 (Ground) to Floor', () => {
    const html = renderComponent();
    // Verify complete floor name is retained in the badge
    expect(html).toContain('Floor 1 (Ground)');
    expect(html).toContain('Floor 2');
  });

  it('renders clean room cards with correct room numbers', () => {
    const html = renderComponent();
    expect(html).toContain('Room 101');
    expect(html).toContain('Room 102');
    expect(html).toContain('Room 201');
    expect(html).toContain('Room 202');
  });

  it('renders compact, dedicated berth indicators with correct tier markers and labels', () => {
    const html = renderComponent();
    // Bunk Upper and Lower short codes
    expect(html).toContain('B1·L');
    expect(html).toContain('B1·U');
    // Single bed short code
    expect(html).toContain('Bed 1');
    // Arrow indicators for bunk tiers
    expect(html).toContain('↑');
    expect(html).toContain('↓');
  });

  it('includes accessible titles and tooltips with tenant names on occupied berths', () => {
    const html = renderComponent();
    // Muhammad Niyas on Room 101 Bed 1
    expect(html).toContain('Muhammed Niyas');
    // Arjun Raj on Room 102 Bunk 1 Lower
    expect(html).toContain('Arjun Raj');
    // Vacant status on Room 102 Upper
    expect(html).toContain('Status: Vacant');
  });

  it('renders clean, un-truncated footer occupancy counts', () => {
    const html = renderComponent();
    // Room 101: 1 occupied (Full)
    expect(html).toContain('1 occupied (Full)');
    // Room 102: 1 occupied · 1 vacant
    expect(html).toContain('1 occupied · 1 vacant');
    // Room 201: All 3 vacant
    expect(html).toContain('All 3 vacant');
    // Room 202: Off-service
    expect(html).toContain('Off-service');
  });

  it('displays appropriate status badge for storage/closed rooms', () => {
    const html = renderComponent();
    expect(html).toContain('Storage');
    expect(html).toContain('Storage facility room');
  });

  it('renders interactive floor filter tabs with room counts', () => {
    const html = renderComponent();
    expect(html).toContain('All Floors (4)');
    expect(html).toContain('Floor 1 (Ground) (2)');
    expect(html).toContain('Floor 2 (2)');
  });
});
