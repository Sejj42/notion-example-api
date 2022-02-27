import "dotenv/config";
import { Client } from "@notionhq/client";
import util from "util";
const notion = new Client({ auth: process.env.NOTION_KEY });
const THE_YEAR = "2022";

const getPagedata = async () => {
  return await notion.databases.query({
    database_id: process.env.NOTION_ORIGIN_DATABASE_ID,
  });
};

const getAllUsersWithTheirInfo = async (pageData) => {
  const allUsersWithAllTheirInfo = await pageData.results.map((result) => {
    const ownerNameGenerator = (input) => {
      if (input.multi_select[0] === undefined) {
        return "N/A";
      } else {
        return input.multi_select[0].name;
      }
    };

    const sprintOrStatusNameGenerator = (input) => {
      if (input === undefined) {
        return "N/A";
      } else {
        return input.select.name;
      }
    };
    return {
      taskId: result.id,
      owner: ownerNameGenerator(result.properties.Owner),
      sprint: sprintOrStatusNameGenerator(result.properties.Sprint),
      status: sprintOrStatusNameGenerator(result.properties.Status),

      gap: result.properties.gap ? result.properties.gap.number : "N/A",
    };
  });
  return allUsersWithAllTheirInfo;
};

const getDataOfOnlyLatestSprint = async (
  latestSprint,
  allUsersWithAllTheirInfo
) => {
  const dataArrayOfLatestSprint = allUsersWithAllTheirInfo.filter((ele) => {
    return ele.sprint === latestSprint;
  });
  return dataArrayOfLatestSprint;
};

const removeDuplicatesFromArray = (array) => {
  return array.filter((item, index) => array.indexOf(item) === index);
};

const getLatestSprint = async (pageData) => {
  const allSprintsArrayWithDuplicates = pageData.results.map((result) => {
    if (result.properties.Sprint) {
      return result.properties.Sprint.select.name;
    }
  });
  const allSprintsArrayNoDuplicates = removeDuplicatesFromArray(
    allSprintsArrayWithDuplicates
  );
  const allSprintsArrayNoDuplicatesNoUndefined =
    allSprintsArrayNoDuplicates.filter((e) => e !== undefined);

  const allSprintsArrayOfThisYear =
    allSprintsArrayNoDuplicatesNoUndefined.filter(
      (e) => e.substring(e.length - 5, e.length - 1) === THE_YEAR
    );

  const sortedAllSprintsArrayOfThisYear = allSprintsArrayOfThisYear.sort(
    (a, b) => {
      return (
        Number(b.substring(b.length - 9, b.length - 7)) -
        Number(a.substring(a.length - 9, a.length - 7))
      );
    }
  );
  const latestSprint = sortedAllSprintsArrayOfThisYear[0];

  return latestSprint;
};

const getAllDataForSingleSprint = async (
  allUsersWithAllTheirInfo,
  sprint
) => {};

const theFunction = async () => {
  const pageData = await getPagedata();
  const latestSprint = await getLatestSprint(pageData);
  const allUsersWithAllTheirInfo = await getAllUsersWithTheirInfo(pageData);
  const dataOfOnlyLatestSprint = getDataOfOnlyLatestSprint(
    latestSprint,
    allUsersWithAllTheirInfo
  );
  console.log(dataOfOnlyLatestSprint);
  //   console.log(util.inspect(pageData, false, null, true /* enable colors */));
  //   const AllUsersWithAllTheirInfo = await getAllUsersWithTheirInfo(pageData);
  //   const allDataForSingleSprint = await getAllDataForSingleSprint(
  //     AllUsersWithAllTheirInfo,
  //     latestSprint
  //   );

  return pageData;
};

theFunction();
