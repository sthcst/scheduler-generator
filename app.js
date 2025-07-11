// This is the React code for your app, now in its own file!

// The 'React' and 'ReactDOM' objects are available globally because we loaded them
// with <script> tags in the HTML file. So, we access useState as React.useState.

// This is the main part of our app, like the central control panel.
function App() {
  // We'll use 'useState' (accessed via React.useState) to keep track of team members and their availability.
  // Think of it like a little notepad where we write down information that can change.
  const [teamMembers, setTeamMembers] = React.useState([]);
  const [newMemberName, setNewMemberName] = React.useState('');
  const [selectedBusySlots, setSelectedBusySlots] = React.useState([]);

  // Core schedule data: who is assigned to which slot (raw data)
  const [currentAssignments, setCurrentAssignments] = React.useState({});
  // Derived data for display: calendar view, hours summary, suggestions
  const [scheduleDisplayData, setScheduleDisplayData] = React.useState(null);

  // State for manual move functionality
  const [memberToMove, setMemberToMove] = React.useState(null); // { name: string, fromSlotId: string }
  const [moveError, setMoveError] = React.useState('');

  // State for Add Person Popup
  const [showAddPersonPopup, setShowAddPersonPopup] = React.useState(false);
  const [popupTargetSlotId, setPopupTargetSlotId] = React.useState(null);
  const [selectedPersonForAdd, setSelectedPersonForAdd] = React.useState('');
  const [addPersonError, setAddPersonError] = React.useState('');


  // New state for shift time setup and max hours limit
  const [shiftStartTime, setShiftStartTime] = React.useState(null); // Stores hour (e.g., 9 for 9 AM)
  const [shiftEndTime, setShiftEndTime] = React.useState(null);   // Stores hour (e.g., 17 for 5 PM)
  const [maxHoursLimit, setMaxHoursLimit] = React.useState(''); // Stores the max hours limit
  const [isSetupComplete, setIsSetupComplete] = React.useState(false);
  const [setupError, setSetupError] = React.useState('');

  // New states for advanced scheduling options
  const [includeDevotional, setIncludeDevotional] = React.useState(false);
  const [meetingDay, setMeetingDay] = React.useState('');
  const [meetingStartTime, setMeetingStartTime] = React.useState(''); // Stored as 'HHMM' string
  const [meetingEndTime, setMeetingEndTime] = React.useState('');   // Stored as 'HHMM' string
  const [peoplePerShift, setPeoplePerShift] = React.useState(1);
  const [requireOverlap, setRequireOverlap] = React.useState(false);

  // Predefined distinct colors for team members
  const memberColors = React.useMemo(() => [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF',
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFFFFC', '#FFABAB',
    '#FFC3A0', '#FFE0B0', '#D6FFB8', '#B7E4F0', '#A7D9FF'
  ], []);
  const colorIndex = React.useRef(0); // To cycle through colors

  // Define all possible 30-minute time slots based on user-defined start/end times
  const allPossibleSlots = React.useMemo(() => {
    if (shiftStartTime === null || shiftEndTime === null) {
      return []; // Return empty if times are not set yet
    }

    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const slots = [];
    days.forEach(day => {
      // Loop from start time up to (but not including) end time
      for (let hour = shiftStartTime; hour < shiftEndTime; hour++) {
        const currentHour12 = hour > 12 ? hour - 12 : hour;
        let ampmCurrent = hour < 12 ? 'AM' : 'PM';
        if (hour === 12) { // Special case for 12 PM
            ampmCurrent = 'PM';
        }

        slots.push({
          id: `${day}-${String(hour).padStart(2, '0')}00`,
          timeId: `${String(hour).padStart(2, '0')}00`, // New: Time-only ID
          dayId: day, // New: Day-only ID
          display: `${currentHour12}:00 ${ampmCurrent}`
        });
        slots.push({
          id: `${day}-${String(hour).padStart(2, '0')}30`,
          timeId: `${String(hour).padStart(2, '0')}30`, // New: Time-only ID
          dayId: day, // New: Day-only ID
          display: `${currentHour12}:30 ${ampmCurrent}`
        });
      }
    });
    return slots;
  }, [shiftStartTime, shiftEndTime]); // Re-run this when start/end times change

  // Determine global restricted slots (devotional, meeting) - memoized for efficiency
  const globalRestrictedSlots = React.useMemo(() => {
      const restricted = [];
      if (includeDevotional) {
          restricted.push('tue-1100', 'tue-1130');
      }
      if (meetingDay && meetingStartTime && meetingEndTime) {
          const startHour = parseInt(meetingStartTime.substring(0,2), 10);
          const startMinute = parseInt(meetingStartTime.substring(2,4), 10);
          const endHour = parseInt(meetingEndTime.substring(0,2), 10);
          const endMinute = parseInt(meetingEndTime.substring(2,4), 10);

          const meetingStartTotalMinutes = startHour * 60 + startMinute;
          const meetingEndTotalMinutes = endHour * 60 + endMinute;

          for (let t = meetingStartTotalMinutes; t < meetingEndTotalMinutes; t += 30) {
              const currentHour = Math.floor(t / 60);
              const currentMinute = t % 60;
              restricted.push(`${meetingDay}-${String(currentHour).padStart(2, '0')}${String(currentMinute).padStart(2, '0')}`);
          }
      }
      return restricted;
  }, [includeDevotional, meetingDay, meetingStartTime, meetingEndTime]);


  // Function to handle setting up the shift times and max hours
  const handleSetupTimes = () => {
    if (shiftStartTime === null || shiftEndTime === null) {
      setSetupError("Please select both a start and an end time.");
      return;
    }
    if (shiftStartTime >= shiftEndTime) {
      setSetupError("Start time must be before end time.");
      return;
    }
    const parsedMaxHours = parseFloat(maxHoursLimit);
    if (isNaN(parsedMaxHours) || parsedMaxHours <= 0) {
      setSetupError("Please enter a valid positive number for maximum hours.");
      return;
    }
    if (peoplePerShift < 1) {
        setSetupError("Number of people per shift must be at least 1.");
        return;
    }

    // Validate meeting times if set
    if (meetingDay && meetingStartTime && meetingEndTime) {
        const startHour = parseInt(meetingStartTime.substring(0,2), 10);
        const startMinute = parseInt(meetingStartTime.substring(2,4), 10);
        const endHour = parseInt(meetingEndTime.substring(0,2), 10);
        const endMinute = parseInt(meetingEndTime.substring(2,4), 10);

        // Convert to total minutes for comparison
        const totalStartMinutes = startHour * 60 + startMinute;
        const totalEndMinutes = endHour * 60 + endMinute;

        if (totalStartMinutes >= totalEndMinutes) {
            setSetupError("Meeting start time must be before meeting end time.");
            return;
        }
        // Check if meeting times are within the overall shift times
        const shiftStartMinutes = shiftStartTime * 60;
        const shiftEndMinutes = shiftEndTime * 60;

        if (totalStartMinutes < shiftStartMinutes || totalEndMinutes > shiftEndMinutes) {
            setSetupError("Meeting times must be within the overall shift times.");
            return;
        }
    }


    setSetupError('');
    setIsSetupComplete(true);
  };

  // This function runs when you click the "Add Member" button.
  // It adds a new person to our team list.
  const handleAddMember = () => {
    if (newMemberName.trim() === '') {
      console.error("Member name cannot be empty."); // Consider a user-facing alert
      return;
    }
    // Calculate available slots by excluding busy slots from all possible slots
    const availableSlots = allPossibleSlots
      .filter(slot => !selectedBusySlots.includes(slot.id))
      .map(slot => slot.id);

    // Filter out global restricted slots from initial availability
    const finalAvailability = availableSlots.filter(slotId => !globalRestrictedSlots.includes(slotId));

    // Assign a unique color
    const assignedColor = memberColors[colorIndex.current % memberColors.length];
    colorIndex.current++;

    // Convert available slots array to a comma-separated string for storage
    const availabilityString = finalAvailability.join(',');
    setTeamMembers([...teamMembers, { name: newMemberName, availability: availabilityString, color: assignedColor }]);
    setNewMemberName(''); // Clear the input field after adding
    setSelectedBusySlots([]); // Clear selected busy slots for the next member
  };

  // Toggles a 30-minute slot's selection (now for busy hours)
  const toggleSlotSelection = (slotId) => {
    setSelectedBusySlots(prevSelected => {
      if (prevSelected.includes(slotId)) {
        // If already selected (busy), remove it (make it available)
        return prevSelected.filter(id => id !== slotId);
      } else {
        // If not selected (available), add it (make it busy)
        return [...prevSelected, slotId];
      }
    });
  };

  // Helper function to calculate display data from raw assignments
  const calculateAndSetScheduleDisplayData = React.useCallback((assignments) => {
    const generatedCalendarData = {};
    const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const uniqueTimeDisplays = Array.from(new Set(allPossibleSlots.map(slot => slot.display)));

    daysOfWeek.forEach(day => {
        generatedCalendarData[day] = {};
        uniqueTimeDisplays.forEach(timeDisplay => {
            const timeId = allPossibleSlots.find(slot => slot.display === timeDisplay && slot.dayId === day)?.timeId;
            if (timeId) {
                generatedCalendarData[day][timeId] = [];
            }
        });
    });

    let hasAssignments = false;
    for (const shiftId in assignments) {
      if (assignments[shiftId].length > 0) {
        const slot = allPossibleSlots.find(s => s.id === shiftId);
        if (slot) {
            const day = slot.dayId;
            const timeId = slot.timeId;
            if (generatedCalendarData[day] && generatedCalendarData[day][timeId]) {
                generatedCalendarData[day][timeId] = assignments[shiftId];
                hasAssignments = true;
            }
        }
      }
    }

    const hoursSummary = {};
    const consistentTimeSuggestions = {};
    const parsedMaxHoursLimit = parseFloat(maxHoursLimit);

    teamMembers.forEach(member => {
        let totalAssignedSlots = 0;
        const assignedTimeIdsForMember = [];
        const daysWorkedByMember = new Set();

        for (const shiftId in assignments) {
            if (assignments[shiftId].includes(member.name)) {
                totalAssignedSlots++;
                const slot = allPossibleSlots.find(s => s.id === shiftId);
                if (slot) {
                    assignedTimeIdsForMember.push(slot.timeId);
                    daysWorkedByMember.add(slot.dayId);
                }
            }
        }
        hoursSummary[member.name] = totalAssignedSlots * 0.5;

        const timeFrequency = {};
        assignedTimeIdsForMember.forEach(timeId => {
            timeFrequency[timeId] = (timeFrequency[timeId] || 0) + 1;
        });

        let mostFrequentTimeId = null;
        let maxFrequency = 0;
        for (const timeId in timeFrequency) {
            if (timeFrequency[timeId] > maxFrequency) {
                maxFrequency = timeFrequency[timeId];
                mostFrequentTimeId = timeId;
            }
        }

        if (mostFrequentTimeId) { // Suggest even if only assigned once, if it's their only assignment
            const suggestedTimeSlot = allPossibleSlots.find(s => s.timeId === mostFrequentTimeId);
            if (suggestedTimeSlot) {
                consistentTimeSuggestions[member.name] = suggestedTimeSlot.display;
            }
        }
    });

    setScheduleDisplayData({
        calendarData: generatedCalendarData,
        hoursSummary: hoursSummary,
        consistentTimeSuggestions: consistentTimeSuggestions,
        hasAssignments: hasAssignments // Pass this flag
    });

  }, [allPossibleSlots, teamMembers, maxHoursLimit]); // Dependencies for useCallback


  // This is where the "smart brain" of our schedule generator lives!
  const generateSchedule = () => {
    if (teamMembers.length === 0) {
      setScheduleDisplayData(null);
      return;
    }

    const assignments = {}; // Temporary assignments for this run
    allPossibleSlots.forEach(slot => {
        assignments[slot.id] = [];
    });

    const memberShiftCounts = {}; // Total 30-min slots assigned
    const memberDailyAssignments = {}; // Tracks if a member has been assigned a slot on a given day
    teamMembers.forEach(member => {
      memberShiftCounts[member.name] = 0;
      memberDailyAssignments[member.name] = { mon: false, tue: false, wed: false, thu: false, fri: false };
    });

    const parsedMaxHoursLimit = parseFloat(maxHoursLimit);

    const membersWithParsedAvailability = teamMembers.map(member => ({
      ...member,
      parsedAvailability: member.availability
        .toLowerCase()
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '')
        .filter(slotId => !globalRestrictedSlots.includes(slotId))
    }));

    // Iterate through all possible shifts (time slot by time slot)
    allPossibleSlots.forEach(shift => {
      if (globalRestrictedSlots.includes(shift.id)) {
          return; // Skip this shift, it's restricted for everyone
      }

      // Determine last assigned member for overlap logic if applicable
      let lastAssignedMemberForOverlap = null;
      if (requireOverlap && peoplePerShift === 1) {
          const currentSlotIndex = allPossibleSlots.findIndex(s => s.id === shift.id);
          if (currentSlotIndex > 0) {
              const previousSlot = allPossibleSlots[currentSlotIndex - 1];
              // Check if it's the same day and if the previous slot was assigned
              if (previousSlot.dayId === shift.dayId && assignments[previousSlot.id] && assignments[previousSlot.id].length > 0) {
                  lastAssignedMemberForOverlap = assignments[previousSlot.id][0];
              }
          }
      }

      // Loop to assign 'peoplePerShift' number of people to the current slot
      while (assignments[shift.id].length < peoplePerShift) {
          const availableForShift = membersWithParsedAvailability.filter(member => {
            const currentHours = memberShiftCounts[member.name] * 0.5;
            return member.parsedAvailability.includes(shift.id) &&
                   (currentHours + 0.5 <= parsedMaxHoursLimit) && // Strict max hours check
                   !assignments[shift.id].includes(member.name); // Not already assigned to this specific slot
          });

          if (availableForShift.length > 0) {
            availableForShift.sort((a, b) => {
                // 1. Prioritize members who haven't worked this day yet (strongest preference)
                const aWorkedToday = memberDailyAssignments[a.name][shift.dayId];
                const bWorkedToday = memberDailyAssignments[b.name][shift.dayId];

                if (!aWorkedToday && bWorkedToday) return -1; // a is better (hasn't worked today)
                if (aWorkedToday && !bWorkedToday) return 1;  // b is better (hasn't worked today)

                // 2. Fairness: Prefer fewer total assigned shifts
                const aCount = memberShiftCounts[a.name];
                const bCount = memberShiftCounts[b.name];
                if (aCount !== bCount) return aCount - bCount;

                // 3. Overlap (if applicable, for single shifts): Penalize if just worked previous slot
                if (requireOverlap && peoplePerShift === 1 && lastAssignedMemberForOverlap) {
                    const aPenaltyOverlap = (a.name === lastAssignedMemberForOverlap) ? 100 : 0; // Large penalty to strongly discourage
                    const bPenaltyOverlap = (b.name === lastAssignedMemberForOverlap) ? 100 : 0;
                    if (aPenaltyOverlap !== bPenaltyOverlap) return aPenaltyOverlap - bPenaltyOverlap;
                }

                // 4. Random Tie-breaker: If all else is equal, randomize
                return Math.random() - 0.5;
            });

            const assignedMember = availableForShift[0];
            assignments[shift.id].push(assignedMember.name);
            memberShiftCounts[assignedMember.name]++;
            memberDailyAssignments[assignedMember.name][shift.dayId] = true; // Mark day as worked
          } else {
              break;
          }
      }
    });

    setCurrentAssignments(assignments); // Set the raw assignments to state
    calculateAndSetScheduleDisplayData(assignments); // Calculate and set display data
  };

  // --- Manual Move Logic ---
  const handleMoveStart = (memberName, fromSlotId) => {
    setMemberToMove({ name: memberName, fromSlotId: fromSlotId });
    setMoveError(''); // Clear any previous move errors
    setShowAddPersonPopup(false); // Close add popup if open
  };

  const handleCancelMove = () => {
    setMemberToMove(null);
    setMoveError('');
  };

  const handleMoveToSlot = (targetSlotId) => {
    if (!memberToMove) return; // No member selected to move

    const { name: memberName, fromSlotId } = memberToMove;
    const parsedMaxHoursLimit = parseFloat(maxHoursLimit);

    // 1. Get the member's current availability (excluding global restrictions)
    const member = teamMembers.find(m => m.name === memberName);
    if (!member) {
        setMoveError("Error: Member not found.");
        setMemberToMove(null);
        return;
    }
    const memberParsedAvailability = member.availability
        .toLowerCase()
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '')
        .filter(slotId => !globalRestrictedSlots.includes(slotId));

    // 2. Validate the move
    if (fromSlotId === targetSlotId) {
        setMoveError("Cannot move to the same slot.");
        setMemberToMove(null);
        return;
    }
    if (globalRestrictedSlots.includes(targetSlotId)) {
        setMoveError("Cannot move to a globally restricted time slot (Devotional/Meeting).");
        setMemberToMove(null);
        return;
    }
    if (!memberParsedAvailability.includes(targetSlotId)) {
        setMoveError(`${memberName} is not available during the selected time.`);
        setMemberToMove(null);
        return;
    }

    // Temporarily calculate hours if moved, to check against max limit
    const tempAssignments = { ...currentAssignments };
    // Remove from old slot
    tempAssignments[fromSlotId] = tempAssignments[fromSlotId].filter(n => n !== memberName);
    // Add to new slot (if not already there)
    if (!tempAssignments[targetSlotId].includes(memberName)) {
        tempAssignments[targetSlotId] = [...tempAssignments[targetSlotId], memberName];
    }

    // Check new hours for the member
    let newMemberHours = 0;
    for (const slotId in tempAssignments) {
        if (tempAssignments[slotId].includes(memberName)) {
            newMemberHours += 0.5;
        }
    }

    if (newMemberHours > parsedMaxHoursLimit) {
        setMoveError(`${memberName} would exceed the maximum hours limit (${parsedMaxHoursLimit} hours) with this move.`);
        setMemberToMove(null);
        return;
    }

    // Check if target slot is already full
    if (tempAssignments[targetSlotId].length > peoplePerShift) { // Note: tempAssignments already includes the member if added
        setMoveError(`The target slot is already full (${peoplePerShift} people).`);
        setMemberToMove(null);
        return;
    }


    // 3. Perform the move
    const updatedAssignments = { ...currentAssignments };

    // Remove member from original slot
    updatedAssignments[fromSlotId] = updatedAssignments[fromSlotId].filter(name => name !== memberName);

    // Add member to new slot
    // Ensure we don't add duplicates if the member was already somehow in the target slot
    if (!updatedAssignments[targetSlotId].includes(memberName)) {
        updatedAssignments[targetSlotId] = [...updatedAssignments[targetSlotId], memberName];
    }

    setCurrentAssignments(updatedAssignments); // Update the raw assignments
    calculateAndSetScheduleDisplayData(updatedAssignments); // Recalculate display data
    setMemberToMove(null); // Clear moving state
    setMoveError(''); // Clear error
  };


  // --- Add Person Popup Logic ---
  const handleCellClickForAdd = (slotId) => {
    if (memberToMove) return; // Don't open popup if in move mode
    setPopupTargetSlotId(slotId);
    setShowAddPersonPopup(true);
    setAddPersonError(''); // Clear previous errors
    setSelectedPersonForAdd(''); // Reset dropdown
  };

  const handleAddPersonToSlot = () => {
    if (!selectedPersonForAdd || !popupTargetSlotId) {
        setAddPersonError("Please select a person.");
        return;
    }

    const memberName = selectedPersonForAdd;
    const targetSlotId = popupTargetSlotId;
    const parsedMaxHoursLimit = parseFloat(maxHoursLimit);

    // 1. Get the member's current availability (excluding global restrictions)
    const member = teamMembers.find(m => m.name === memberName);
    if (!member) {
        setAddPersonError("Error: Selected member not found.");
        return;
    }
    const memberParsedAvailability = member.availability
        .toLowerCase()
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '')
        .filter(slotId => !globalRestrictedSlots.includes(slotId));

    // 2. Validate the assignment
    if (globalRestrictedSlots.includes(targetSlotId)) {
        setAddPersonError("Cannot assign to a globally restricted time slot (Devotional/Meeting).");
        return;
    }
    if (!memberParsedAvailability.includes(targetSlotId)) {
        setAddPersonError(`${memberName} is not available during the selected time.`);
        return;
    }

    // Check if member is already in this slot
    if (currentAssignments[targetSlotId] && currentAssignments[targetSlotId].includes(memberName)) {
        setAddPersonError(`${memberName} is already assigned to this slot.`);
        return;
    }

    // Temporarily calculate hours if added, to check against max limit
    const tempAssignments = { ...currentAssignments };
    tempAssignments[targetSlotId] = [...(tempAssignments[targetSlotId] || []), memberName];

    let newMemberHours = 0;
    for (const slotId in tempAssignments) {
        if (tempAssignments[slotId].includes(memberName)) {
            newMemberHours += 0.5;
        }
    }

    if (newMemberHours > parsedMaxHoursLimit) {
        setAddPersonError(`${memberName} would exceed the maximum hours limit (${parsedMaxHoursLimit} hours) with this assignment.`);
        return;
    }

    // Check if target slot is already full
    if (tempAssignments[targetSlotId].length > peoplePerShift) {
        setAddPersonError(`The target slot is already full (${peoplePerShift} people).`);
        return;
    }

    // 3. Perform the assignment
    const updatedAssignments = { ...currentAssignments };
    updatedAssignments[targetSlotId] = [...(updatedAssignments[targetSlotId] || []), memberName];

    setCurrentAssignments(updatedAssignments);
    calculateAndSetScheduleDisplayData(updatedAssignments);
    setShowAddPersonPopup(false); // Close popup
    setPopupTargetSlotId(null);
    setSelectedPersonForAdd('');
    setAddPersonError('');
  };

  const handleRemovePersonFromSlot = (memberName, slotId) => {
    const updatedAssignments = { ...currentAssignments };
    updatedAssignments[slotId] = updatedAssignments[slotId].filter(name => name !== memberName);

    setCurrentAssignments(updatedAssignments);
    calculateAndSetScheduleDisplayData(updatedAssignments);
  };

  const handleCloseAddPersonPopup = () => {
    setShowAddPersonPopup(false);
    setPopupTargetSlotId(null);
    setSelectedPersonForAdd('');
    setAddPersonError('');
  };


  // Helper to format 24-hour time to 12-hour AM/PM
  const formatHourTo12Hr = (hour) => {
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12} ${ampm}`;
  };

  // Helper to format HHMM string to 12-hour AM/PM
  const formatHHMMTo12Hr = (hhmm) => {
    if (!hhmm) return '';
    const hour = parseInt(hhmm.substring(0, 2), 10);
    const minute = hhmm.substring(2, 4);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute} ${ampm}`;
  };

  // Generate time options for meeting dropdowns (30-min intervals)
  const generateTimeOptions = React.useCallback(() => {
    const options = [];
    if (shiftStartTime === null || shiftEndTime === null) return [];

    // Iterate through all 30-minute intervals from shiftStartTime to shiftEndTime
    for (let currentMinutes = shiftStartTime * 60; currentMinutes <= shiftEndTime * 60; currentMinutes += 30) {
        const hour = Math.floor(currentMinutes / 60);
        const minute = currentMinutes % 60;
        const hhmm = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
        options.push({ value: hhmm, label: formatHHMMTo12Hr(hhmm) });
    }
    return options;
  }, [shiftStartTime, shiftEndTime]);

  // Function to remove a team member
  const handleRemoveMember = (memberNameToRemove) => {
    // Filter out the member to remove
    const updatedTeamMembers = teamMembers.filter(member => member.name !== memberNameToRemove);
    setTeamMembers(updatedTeamMembers);

    // Also remove them from current assignments and regenerate schedule display
    const updatedAssignments = { ...currentAssignments };
    for (const slotId in updatedAssignments) {
        updatedAssignments[slotId] = updatedAssignments[slotId].filter(name => name !== memberNameToRemove);
    }
    setCurrentAssignments(updatedAssignments); // Update raw assignments
    calculateAndSetScheduleDisplayData(updatedAssignments); // Recalculate display data
  };


  // Main render logic based on setup completion
  if (!isSetupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex items-center justify-center p-4 font-inter">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-6">Setup Your Schedule Parameters</h1>
          <p className="text-gray-600 mb-6">
            Define shift times, hour limits, and any team-wide restrictions.
          </p>
          <div className="flex flex-col gap-4 mb-6">
            {/* Shift Start/End Times */}
            <div>
              <label htmlFor="startTime" className="block text-left text-gray-700 text-sm font-medium mb-1">
                Shift Start Time:
              </label>
              <select
                id="startTime"
                className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                value={shiftStartTime === null ? '' : shiftStartTime}
                onChange={(e) => setShiftStartTime(parseInt(e.target.value, 10))}
              >
                <option value="" disabled>Select start hour</option>
                {[...Array(15).keys()].map(i => i + 6).map(hour => ( // Hours from 6 AM to 8 PM (20)
                  <option key={hour} value={hour}>
                    {formatHourTo12Hr(hour)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="endTime" className="block text-left text-gray-700 text-sm font-medium mb-1">
                Shift End Time:
              </label>
              <select
                id="endTime"
                className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                value={shiftEndTime === null ? '' : shiftEndTime}
                onChange={(e) => setShiftEndTime(parseInt(e.target.value, 10))}
              >
                <option value="" disabled>Select end hour</option>
                {[...Array(15).keys()].map(i => i + 7).map(hour => ( // Hours from 7 AM to 9 PM (21)
                  <option key={hour} value={hour}>
                    {formatHourTo12Hr(hour)}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Hours Per Student */}
            <div>
              <label htmlFor="maxHours" className="block text-left text-gray-700 text-sm font-medium mb-1">
                Maximum Hours Per Student:
              </label>
              <input
                type="number"
                id="maxHours"
                placeholder="e.g., 19 (hours)"
                className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                value={maxHoursLimit}
                onChange={(e) => setMaxHoursLimit(e.target.value)}
                min="0.5" // Minimum 30 mins
                step="0.5" // Increments of 30 mins
              />
            </div>

            {/* People Per Shift */}
            <div>
              <label htmlFor="peoplePerShift" className="block text-left text-gray-700 text-sm font-medium mb-1">
                Number of People Per 30-min Shift:
              </label>
              <input
                type="number"
                id="peoplePerShift"
                placeholder="e.g., 1 or 2"
                className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                value={peoplePerShift}
                onChange={(e) => setPeoplePerShift(parseInt(e.target.value, 10))}
                min="1"
                step="1"
              />
            </div>

            {/* Devotional Restriction */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeDevotional"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={includeDevotional}
                onChange={(e) => setIncludeDevotional(e.target.checked)}
              />
              <label htmlFor="includeDevotional" className="ml-2 text-gray-700 text-sm font-medium">
                Include Tuesday 11:00 AM - 12:00 PM Devotional as Busy
              </label>
            </div>

            {/* All-Hands Meeting */}
            <div className="border p-4 rounded-lg bg-gray-50">
                <h3 className="text-md font-semibold text-gray-800 mb-2">Mandatory All-Hands Meeting (for all workers)</h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <select
                        className="flex-grow p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={meetingDay}
                        onChange={(e) => setMeetingDay(e.target.value)}
                    >
                        <option value="">Select Day</option>
                        <option value="mon">Monday</option>
                        <option value="tue">Tuesday</option>
                        <option value="wed">Wednesday</option>
                        <option value="thu">Thursday</option>
                        <option value="fri">Friday</option>
                    </select>
                    <select
                        className="flex-grow p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={meetingStartTime}
                        onChange={(e) => setMeetingStartTime(e.target.value)}
                        disabled={!meetingDay || shiftStartTime === null || shiftEndTime === null}
                    >
                        <option value="">Start Time</option>
                        {generateTimeOptions().map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <select
                        className="flex-grow p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={meetingEndTime}
                        onChange={(e) => setMeetingEndTime(e.target.value)}
                        disabled={!meetingDay || !meetingStartTime || shiftStartTime === null || shiftEndTime === null}
                    >
                        <option value="">End Time</option>
                        {generateTimeOptions().map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <p className="text-gray-500 text-xs italic">This time will be busy for all students and counts towards their cap.</p>
            </div>

            {/* Overlap Requirement */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="requireOverlap"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={requireOverlap}
                onChange={(e) => setRequireOverlap(e.target.checked)}
                disabled={peoplePerShift > 1} // Disable if more than 1 person per shift (overlap concept changes)
              />
              <label htmlFor="requireOverlap" className="ml-2 text-gray-700 text-sm font-medium">
                Require 30-min Overlap Between Shifts (for 1 person/shift)
              </label>
            </div>

          </div>
          {setupError && (
            <p className="text-red-600 text-sm mb-4">{setupError}</p>
          )}
          <button
            onClick={handleSetupTimes}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-300 transform hover:scale-105"
          >
            Set Schedule Parameters
          </button>
        </div>
      </div>
    );
  }

  // Main application UI (rendered after setup is complete)
  return (
    // This is the main container for our app, styled with Tailwind CSS for a nice look.
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex items-center justify-center p-4 font-inter">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl"> {/* Changed max-w-2xl to max-w-4xl */}
        <h1 className="text-4xl font-extrabold text-gray-800 mb-6 text-center">
          Team Schedule Generator
        </h1>

        {/* Section for adding team members */}
        <div className="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
          <h2 className="text-2xl font-semibold text-blue-700 mb-4">Add Team Members</h2>
          <p className="text-gray-600 mb-4">
            Enter the team member's name, then click on the 30-minute time blocks below when they are **BUSY**.
            Any unselected blocks will be considered available.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="Member Name (e.g., Alex)"
              className="flex-grow p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
            />
            <button
              onClick={handleAddMember}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-300 transform hover:scale-105"
            >
              Add Member
            </button>
          </div>

          {/* Combined section for busy blocks and current team */}
          <div className="flex flex-col md:flex-row gap-6 mt-4">
            {/* Time Slot Selection Grid (for busy hours) */}
            <div className="p-4 bg-blue-100 rounded-lg shadow-inner md:w-2/3"> {/* Adjusted width */}
              <h3 className="text-lg font-medium text-blue-700 mb-3">Select Busy Blocks:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {['mon', 'tue', 'wed', 'thu', 'fri'].map(day => (
                  <div key={day} className="bg-white p-3 rounded-lg shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">{day.charAt(0).toUpperCase() + day.slice(1)}</h4>
                    <div className="flex flex-col gap-1">
                      {allPossibleSlots.filter(slot => slot.id.startsWith(day)).map(slot => (
                        <button
                          key={slot.id}
                          className={`w-full text-sm py-2 px-3 rounded-md transition duration-200
                            ${selectedBusySlots.includes(slot.id) // Check against selectedBusySlots
                              ? 'bg-red-500 text-white shadow-md' // Red for busy
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300' // Gray for available
                            }`}
                          onClick={() => toggleSlotSelection(slot.id)}
                        >
                          {slot.display}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Displaying the list of added team members */}
            <div className="p-4 bg-blue-100 rounded-lg shadow-inner md:w-1/3"> {/* Adjusted width */}
              <h3 className="text-lg font-medium text-blue-600 mb-2">Current Team:</h3>
              {teamMembers.length === 0 ? (
                <p className="text-gray-500 italic">No members added yet.</p>
              ) : (
                <ul className="list-none space-y-1 text-gray-700">
                  {teamMembers.map((member, index) => (
                    <li key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                      <span className="font-medium flex items-center">
                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: member.color }}></span>
                        {member.name}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(member.name)}
                        className="ml-2 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold"
                        title="Remove member"
                      >
                        X
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div> {/* End of combined section */}
        </div>

        {/* Section for generating the schedule */}
        <div className="mb-8 p-6 bg-purple-50 rounded-lg shadow-inner">
          <h2 className="text-2xl font-semibold text-purple-700 mb-4">Generate Schedule</h2>
          <button
            onClick={generateSchedule}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-300 transform hover:scale-105"
          >
            Generate Team Schedule
          </button>
        </div>

        {/* Section to display the generated schedule */}
        {scheduleDisplayData && (
          <div className="p-6 bg-green-50 rounded-lg shadow-inner">
            <h2 className="text-2xl font-semibold text-green-700 mb-4">Your Generated Schedule</h2>

            {/* Moving Indicator and Error */}
            {memberToMove && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Moving:</strong>
                    <span className="block sm:inline ml-2">{memberToMove.name} from {allPossibleSlots.find(s => s.id === memberToMove.fromSlotId)?.display} on {memberToMove.fromSlotId.split('-')[0].charAt(0).toUpperCase() + memberToMove.fromSlotId.split('-')[0].slice(1)}. Click a new slot to move.</span>
                    <button
                        onClick={handleCancelMove}
                        className="ml-4 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-full transition duration-200"
                    >
                        Cancel Move
                    </button>
                </div>
            )}
            {moveError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Move Error:</strong>
                    <span className="block sm:inline ml-2">{moveError}</span>
                </div>
            )}
            {/* Add Person Popup */}
            {showAddPersonPopup && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-80">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Assign Person to Slot</h3>
                        <p className="text-gray-600 mb-3">
                            Assign to: {allPossibleSlots.find(s => s.id === popupTargetSlotId)?.display} on {popupTargetSlotId.split('-')[0].charAt(0).toUpperCase() + popupTargetSlotId.split('-')[0].slice(1)}
                        </p>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-md mb-3"
                            value={selectedPersonForAdd}
                            onChange={(e) => setSelectedPersonForAdd(e.target.value)}
                        >
                            <option value="" disabled>Select a person</option>
                            {teamMembers.map(member => (
                                <option key={member.name} value={member.name}>{member.name}</option>
                            ))}
                        </select>
                        {addPersonError && <p className="text-red-600 text-sm mb-3">{addPersonError}</p>}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleCloseAddPersonPopup}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddPersonToSlot}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
                            >
                                Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Check if schedule.calendarData exists and has assignments */}
            {scheduleDisplayData.hasAssignments ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-green-100 rounded-lg shadow-md">
                  <thead>
                    <tr className="bg-green-200 text-green-800 uppercase text-sm leading-normal">
                      <th className="py-3 px-2 text-left rounded-tl-lg w-24">Time</th> {/* Time column header */}
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                        <th key={day} className="py-3 px-2 text-center">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 text-sm font-light">
                    {/* Get unique time displays for rows */}
                    {Array.from(new Set(allPossibleSlots.map(slot => slot.display))).map(timeDisplay => {
                      // Find the corresponding timeId (e.g., '0900') for the current timeDisplay
                      // We need to pick one, as all days will have the same time IDs
                      const sampleSlot = allPossibleSlots.find(slot => slot.display === timeDisplay);
                      const timeId = sampleSlot ? sampleSlot.id.split('-')[1] : null;

                      return (
                        <tr key={timeDisplay} className="border-b border-green-200 hover:bg-green-50">
                          <td className="py-2 px-2 text-left font-medium whitespace-nowrap">{timeDisplay}</td> {/* Time label */}
                          {['mon', 'tue', 'wed', 'thu', 'fri'].map(day => {
                            const currentSlotId = `${day}-${timeId}`;
                            const isSelectedForMoveOrigin = memberToMove && memberToMove.fromSlotId === currentSlotId;
                            const isTargetSlot = memberToMove && !isSelectedForMoveOrigin; // Highlight potential target slots
                            const isGloballyRestricted = globalRestrictedSlots.includes(currentSlotId);

                            return (
                                <td
                                    key={currentSlotId}
                                    className={`py-2 px-2 text-center border-l border-green-200
                                        ${isSelectedForMoveOrigin ? 'bg-yellow-300 border-yellow-500' : ''}
                                        ${isTargetSlot ? 'hover:bg-blue-200 cursor-pointer' : (memberToMove ? 'cursor-not-allowed' : 'cursor-pointer')}
                                        ${isGloballyRestricted ? 'bg-gray-300 text-gray-500 italic' : ''}
                                    `}
                                    onClick={() => {
                                        if (memberToMove) {
                                            handleMoveToSlot(currentSlotId);
                                        } else if (!isGloballyRestricted) { // Only allow adding to non-restricted slots
                                            handleCellClickForAdd(currentSlotId);
                                        }
                                    }}
                                >
                                    {scheduleDisplayData.calendarData[day] && scheduleDisplayData.calendarData[day][timeId] && scheduleDisplayData.calendarData[day][timeId].length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {scheduleDisplayData.calendarData[day][timeId].map(assignedMemberName => {
                                                const memberColor = teamMembers.find(m => m.name === assignedMemberName)?.color || '#ccc'; // Default color
                                                return (
                                                    <span
                                                        key={assignedMemberName}
                                                        className="block p-1 rounded-md text-xs font-semibold flex items-center justify-between"
                                                        style={{ backgroundColor: memberColor, color: '#333' }} // Apply color
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent triggering cell click
                                                            handleRemovePersonFromSlot(assignedMemberName, currentSlotId);
                                                        }}
                                                        title={`Remove ${assignedMemberName}`}
                                                    >
                                                        {assignedMemberName}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Prevent triggering cell click
                                                                handleMoveStart(assignedMemberName, currentSlotId);
                                                            }}
                                                            className="ml-1 px-1 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs"
                                                            title="Move this person"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Prevent triggering cell click
                                                                handleRemovePersonFromSlot(assignedMemberName, currentSlotId);
                                                            }}
                                                            className="ml-1 px-1 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs"
                                                            title="Remove this person"
                                                        >
                                                            X
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">
                                            {isGloballyRestricted ? 'Restricted' : '-'}
                                        </span>
                                    )}
                                </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">No assignments could be made for the provided availability.</p>
            )}

            {/* Hours Summary Section */}
            {scheduleDisplayData.hoursSummary && Object.keys(scheduleDisplayData.hoursSummary).length > 0 && (
                <div className="mt-8 p-4 bg-green-100 rounded-lg border border-green-200 shadow-sm">
                    <h3 className="text-xl font-semibold text-green-800 mb-3">Total Hours Assigned:</h3>
                    {parseFloat(maxHoursLimit) > 0 && (
                        <p className="text-lg text-gray-700 mb-3">
                            Maximum hours per student: <span className="font-bold text-blue-700">{maxHoursLimit} hours</span>
                        </p>
                    )}
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {Object.entries(scheduleDisplayData.hoursSummary).map(([memberName, hours]) => (
                            <li key={memberName} className="flex items-center">
                                <span className="text-green-600 mr-2">&#8226;</span>
                                <span className="font-medium">{memberName}:</span> {hours} hours
                                {parseFloat(maxHoursLimit) > 0 && hours < parseFloat(maxHoursLimit) && (
                                    <span className="ml-2 text-orange-600 font-bold">({(parseFloat(maxHoursLimit) - hours).toFixed(1)} hours under limit)</span>
                                )}
                                {/* With strict cap, this should ideally not happen, but kept for robustness */}
                                {parseFloat(maxHoursLimit) > 0 && hours > parseFloat(maxHoursLimit) && (
                                    <span className="ml-2 text-red-600 font-bold">(OVER LIMIT!)</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Consistent Time Suggestions Section */}
            {scheduleDisplayData.consistentTimeSuggestions && Object.keys(scheduleDisplayData.consistentTimeSuggestions).length > 0 && (
                <div className="mt-8 p-4 bg-blue-100 rounded-lg border border-blue-200 shadow-sm">
                    <h3 className="text-xl font-semibold text-blue-800 mb-3">Consistent Time Suggestions:</h3>
                    <p className="text-gray-700 mb-2">
                        For students who couldn't work every day, here's a time block they were frequently assigned to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {Object.entries(scheduleDisplayData.consistentTimeSuggestions).map(([memberName, timeDisplay]) => (
                            <li key={memberName} className="flex items-center">
                                <span className="text-blue-600 mr-2">&#8226;</span>
                                <span className="font-medium">{memberName}:</span> Try to schedule around {timeDisplay}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// This is how we tell React to put our App component onto the web page.
// ReactDOM.createRoot is the modern way to render React apps.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
