import moment from "@/shared/utils/time";

export default function latestRangeDefaults() {
  return {
    startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD'),
  };
}