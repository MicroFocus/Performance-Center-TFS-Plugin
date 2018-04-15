
using System;
using System.Collections.Generic;


namespace PC.Plugins.Common.PCEntities
{
	public sealed class PCRunState
	{
        // The order in this enum is important, changing it could harm other code.
        // please see functions on PCClient waitForRunCompletion and waitForRunState.
        public static readonly PCRunState UNDEFINED = new PCRunState("UNDEFINED", InnerEnum.UNDEFINED, "");
		public static readonly PCRunState INITIALIZING = new PCRunState("INITIALIZING", InnerEnum.INITIALIZING, "Initializing");
		public static readonly PCRunState RUNNING = new PCRunState("RUNNING", InnerEnum.RUNNING, "Running");
		public static readonly PCRunState STOPPING = new PCRunState("STOPPING", InnerEnum.STOPPING, "Stopping");
		public static readonly PCRunState BEFORE_COLLATING_RESULTS = new PCRunState("BEFORE_COLLATING_RESULTS", InnerEnum.BEFORE_COLLATING_RESULTS, "Before Collating Results");
		public static readonly PCRunState COLLATING_RESULTS = new PCRunState("COLLATING_RESULTS", InnerEnum.COLLATING_RESULTS, "Collating Results");
		public static readonly PCRunState BEFORE_CREATING_ANALYSIS_DATA = new PCRunState("BEFORE_CREATING_ANALYSIS_DATA", InnerEnum.BEFORE_CREATING_ANALYSIS_DATA, "Before Creating Analysis Data");
		public static readonly PCRunState PENDING_CREATING_ANALYSIS_DATA = new PCRunState("PENDING_CREATING_ANALYSIS_DATA", InnerEnum.PENDING_CREATING_ANALYSIS_DATA, "Pending Creating Analysis Data");
		public static readonly PCRunState CREATING_ANALYSIS_DATA = new PCRunState("CREATING_ANALYSIS_DATA", InnerEnum.CREATING_ANALYSIS_DATA, "Creating Analysis Data");
		public static readonly PCRunState FINISHED = new PCRunState("FINISHED", InnerEnum.FINISHED, "Finished");
		public static readonly PCRunState FAILED_COLLATING_RESULTS = new PCRunState("FAILED_COLLATING_RESULTS", InnerEnum.FAILED_COLLATING_RESULTS, "Failed Collating Results");
		public static readonly PCRunState FAILED_CREATING_ANALYSIS_DATA = new PCRunState("FAILED_CREATING_ANALYSIS_DATA", InnerEnum.FAILED_CREATING_ANALYSIS_DATA, "Failed Creating Analysis Data");
		public static readonly PCRunState CANCELED = new PCRunState("CANCELED", InnerEnum.CANCELED, "Canceled");
		public static readonly PCRunState RUN_FAILURE = new PCRunState("RUN_FAILURE", InnerEnum.RUN_FAILURE, "Run Failure");

		private static readonly IList<PCRunState> valueList = new List<PCRunState>();

		static PCRunState()
		{
			valueList.Add(UNDEFINED);
			valueList.Add(INITIALIZING);
			valueList.Add(RUNNING);
			valueList.Add(STOPPING);
			valueList.Add(BEFORE_COLLATING_RESULTS);
			valueList.Add(COLLATING_RESULTS);
			valueList.Add(BEFORE_CREATING_ANALYSIS_DATA);
			valueList.Add(PENDING_CREATING_ANALYSIS_DATA);
			valueList.Add(CREATING_ANALYSIS_DATA);
			valueList.Add(FINISHED);
			valueList.Add(FAILED_COLLATING_RESULTS);
			valueList.Add(FAILED_CREATING_ANALYSIS_DATA);
			valueList.Add(CANCELED);
			valueList.Add(RUN_FAILURE);
		}

		public enum InnerEnum
		{
			UNDEFINED,
			INITIALIZING,
			RUNNING,
			STOPPING,
			BEFORE_COLLATING_RESULTS,
			COLLATING_RESULTS,
			BEFORE_CREATING_ANALYSIS_DATA,
			PENDING_CREATING_ANALYSIS_DATA,
			CREATING_ANALYSIS_DATA,
			FINISHED,
			FAILED_COLLATING_RESULTS,
			FAILED_CREATING_ANALYSIS_DATA,
			CANCELED,
			RUN_FAILURE
		}

		public readonly InnerEnum innerEnumValue;
		private readonly string nameValue;
		private readonly int ordinalValue;
		private static int nextOrdinal = 0;



		private string _value;

		private PCRunState(string name, InnerEnum innerEnum, string value)
		{
			this._value = value;

			nameValue = name;
			ordinalValue = nextOrdinal++;
			innerEnumValue = innerEnum;
		}

        public string Value => _value;

        public bool hasFailure() => _value.ToLower().Contains("fail");

        public static PCRunState get(string val)
		{
			foreach (PCRunState state in PCRunState.values())
			{
				if (val.Equals(state.Value))
				{
						return state;
				}
			}
			return UNDEFINED;
		}

        public static IList<PCRunState> values() => valueList;

        public int ordinal() => ordinalValue;

        public override string ToString() => nameValue;

        public static PCRunState valueOf(string name)
		{
			foreach (PCRunState enumInstance in PCRunState.valueList)
			{
				if (enumInstance.nameValue == name)
				{
					return enumInstance;
				}
			}
			throw new System.ArgumentException(name);
		}
	}

}