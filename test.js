import "dotenv/config";
import { Client } from "@notionhq/client";
import util from "util";

const notion = new Client({ auth: process.env.NOTION_KEY });
const THE_YEAR = "2022";

const removeDuplicatesFromArray = (array) => {
  return array.filter((item, index) => array.indexOf(item) === index);
};

const getPagedata = async () => {
  return await notion.databases.query({
    database_id: process.env.NOTION_ORIGIN_DATABASE_ID,
  });
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
      gap: result.properties.gap ? result.properties.gap.number : "N/A",
      //   status: sprintOrStatusNameGenerator(result.properties.Status),
    };
  });
  return allUsersWithAllTheirInfo;
};

const getDataOfOnlyLatestSprint = async (
  latestSprint,
  allUsersWithAllTheirInfo
) => {
  const dataArrayOfOnlyLatestSprint = allUsersWithAllTheirInfo.filter(
    (ele) => ele.sprint === latestSprint
  );
  return dataArrayOfOnlyLatestSprint;
};

const getUserArray = async (dataOfOnlyLatestSprint) => {
  const unfilteredUserArray = dataOfOnlyLatestSprint.map((ele) => {
    return ele.owner;
  });
  const userArray = removeDuplicatesFromArray(unfilteredUserArray);
  return userArray;
};

const getTasksPerUser = async (userArray, dataOfOnlyLatestSprint) => {
  const tasksPerUser = userArray.map((user) => {
    let singleUserTasksObject = {
      name: user,
      score: 0,
      timeGaps: [],
    };

    dataOfOnlyLatestSprint.forEach((task) => {
      if (task.userId === user.userId) {
        singleUserTasksObject.timeGaps.push(task.gap);
        singleUserTasksObject.score += task.gap;
      }
    });
    return singleUserTasksObject;
  });
  return tasksPerUser;
};

const arrayOfEntriesGenerator = async (tasksPerUser) => {
  const timeGapsNotEmptyValidator = (timeGaps) => {
    if (timeGaps.join(",") === "") {
      return "N/A";
    } else {
      return timeGaps.join(",");
    }
  };

  const scoreNotZeroValidator = (score) => {
    if (score === 0) {
      return "N/A";
    } else {
      return (-1 * score).toString();
    }
  };

  const arrayOfAllEntries = tasksPerUser.map((entry) => {
    console.log("below is single entry");
    console.log(util.inspect(entry, false, null, true /* enable colors */));

    return {
      Name: {
        title: [
          {
            text: {
              content: entry.name,
            },
          },
        ],
      },
      Score: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: scoreNotZeroValidator(entry.score),
            },
          },
        ],
      },
      timeGaps: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: timeGapsNotEmptyValidator(entry.timeGaps),
            },
          },
        ],
      },
    };
  });
  return arrayOfAllEntries;
};

const entryAdder = async (arrayOfAllEntries) => {
  for (const entry of arrayOfAllEntries) {
    await addEntry(entry);
  }
  //   arrayOfAllEntries.forEach((entry) => {
  //     // console.log(util.inspect(entry, false, null, true /* enable colors */));
  //     return addEntry(entry);
  //   });
};

const addEntry = async (entry) => {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_NEW_TARGET_DATABASE_ID,
      },
      properties: entry,
    });
    console.log(response);
    console.log("Success! Entry added.");
  } catch (error) {
    console.error(error);
  }
};

const theFunction = async () => {
  const pageData = await getPagedata();
  const latestSprint = await getLatestSprint(pageData);
  const allUsersWithAllTheirInfo = await getAllUsersWithTheirInfo(pageData);
  const dataOfOnlyLatestSprint = await getDataOfOnlyLatestSprint(
    latestSprint,
    allUsersWithAllTheirInfo
  );
  const userArray = await getUserArray(dataOfOnlyLatestSprint);
  const tasksPerUser = await getTasksPerUser(userArray, dataOfOnlyLatestSprint);
  const arrayOfAllEntries = await arrayOfEntriesGenerator(tasksPerUser);
  console.log("below is arrayOfAllEntries");
  console.log(
    util.inspect(arrayOfAllEntries, false, null, true /* enable colors */)
  );

  await entryAdder(arrayOfAllEntries);

  return "success";
};

theFunction();
