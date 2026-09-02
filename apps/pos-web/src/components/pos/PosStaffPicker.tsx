"use client";

export type EligibleStaffMember = {
  id: string;
  displayName: string;
  employeeCode: string;
  profilePhotoUrl: string | null;
};

export function PosStaffPicker({
  staff,
  loading,
  onSelect,
  onManagerSignIn,
}: {
  staff: EligibleStaffMember[];
  loading?: boolean;
  onSelect: (member: EligibleStaffMember) => void;
  onManagerSignIn: () => void;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Who&apos;s on counter?</h1>
        <p className="text-gray-400 mt-1">Select your name, then enter your PIN</p>
      </div>

      {loading ? (
        <p className="text-center text-gray-400">Loading staff…</p>
      ) : staff.length === 0 ? (
        <p className="text-center text-gray-400">
          No PIN-enabled staff for this terminal. Ask a manager to set up employee PINs.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-800 border border-gray-700 hover:border-orange-500 hover:bg-gray-750 transition-colors"
            >
              <div className="h-14 w-14 rounded-full bg-orange-600/20 text-orange-400 flex items-center justify-center text-lg font-bold">
                {member.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">{member.displayName}</p>
                <p className="text-xs text-gray-500">{member.employeeCode}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={onManagerSignIn}
          className="text-sm text-gray-400 hover:text-orange-400 underline-offset-2 hover:underline"
        >
          Manager sign in (email)
        </button>
      </div>
    </div>
  );
}
