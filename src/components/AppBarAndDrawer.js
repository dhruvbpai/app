import React, { useState } from "react";
import PropTypes from "prop-types";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core";
import { Link } from "react-router-dom";
import AccountCircle from "@material-ui/icons/AccountCircle";
import MenuIcon from "@material-ui/icons/Menu";
import Button from "@material-ui/core/Button";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import IconButton from "@material-ui/core/IconButton";
import Hidden from "@material-ui/core/Hidden";
import Divider from "@material-ui/core/Divider";
import Drawer from "@material-ui/core/Drawer";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { push as pushURL } from 'connected-react-router/immutable';
import { useDispatch } from 'react-redux';

const useStyles = makeStyles(theme => ({
  grow: { flexGrow: 1 },
  headerLink: {
    color: theme.palette.primary.contrastText,
    textDecoration: "none",
    "& > a": {
      textDecoration: "none"
    }
  },
  appBar: {
    marginBottom: theme.spacing(2)
  },
  drawerHeader: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    textDecoration: 'none',
  }
}));

function AppBarAndDrawer(props) {
  const classes = useStyles();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = props.user;
  const dispatch = useDispatch();
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const isAuthenticated =  user.get("isAuthenticated");

  const handleProfileMenuClick = () => {
    setProfileMenuAnchor(null);
  };

  const toggleDrawerOpen = () => {
    setDrawerOpen(!drawerOpen);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const launchURL = (url) => {
    dispatch(pushURL(url));
    closeDrawer();
  }

  return (
    <AppBar position="relative" className={classes.appBar}>
      <Toolbar variant="dense">
        <Hidden only={["lg", "xl", "md"]}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            aria-controls="simple-menu"
            aria-haspopup="true"
            onClick={toggleDrawerOpen}
          >
            <MenuIcon />
          </IconButton>
          <Drawer open={drawerOpen} onClose={toggleDrawerOpen}>
            <Typography
              variant="h5"
              component={Link}
              to="/"
              onClick={closeDrawer}
              className={classes.drawerHeader}
            >
              COVID-19 Assist
            </Typography>
            <Divider />
            <List>
              <ListItem
                onClick={() => {
                  launchURL("/request");
                }}
              >
                <ListItemText primary="Request Assistance" />
              </ListItem>
              <ListItem
                onClick={() => {
                  launchURL("/search");
                }}
              >
                <ListItemText primary="Help Someone" />
              </ListItem>
              <ListItem
                onClick={() => {
                  launchURL("/");
                }}
              >
                <ListItemText primary="Home" />
              </ListItem>
              <ListItem
                onClick={() => {
                  launchURL("/donate");
                }}
              >
                <ListItemText primary="Donate" />
              </ListItem>
              <ListItem
                onClick={() => {
                  launchURL("/blog");
                }}
              >
                <ListItemText primary="Blog" />
              </ListItem>
              <ListItem
                onClick={() => {
                  launchURL("/contact");
                }}
              >
                <ListItemText primary="Contact" />
              </ListItem>
              <ListItem
                onClick={() => {
                  launchURL("/about");
                }}
              >
                <ListItemText primary="About" />
              </ListItem>
            </List>
          </Drawer>
        </Hidden>

        <Typography variant="h6" color="inherit" noWrap>
          <Link to="/" className={classes.headerLink}>
            COVID-19 Assist
          </Link>
        </Typography>
        <div className={classes.grow} />
        <Hidden only={["sm", "xs"]}>
          <Button
            component={Link}
            to="/request"
            color="inherit"
            variant={!isAuthenticated ? "outlined" : "text"}
          >
            Request Assistance
          </Button>
          <Button
            component={Link}
            to="/search"
            color="inherit"
            variant={isAuthenticated ? "outlined" : "text"}
          >
            Help Someone
          </Button>
          <Button component={Link} to="/donate" color="inherit">
            Donate
          </Button>
          <Button component={Link} to="/blog" color="inherit">
            Blog
          </Button>
          <Button component={Link} to="/contact" color="inherit">
            Contact
          </Button>
          <Button component={Link} to="/about" color="inherit">
            About
          </Button>
        </Hidden>

        {isAuthenticated === false ? (
          <Button component={Link} to="/login" color="inherit">
            Login
          </Button>
        ) : (
          user.get("userProfile") !== null && (
            <React.Fragment>
              <Hidden only={["lg", "xl", "md"]}>
                <IconButton
                  color="inherit"
                  onClick={event => setProfileMenuAnchor(event.currentTarget)}
                >
                  <AccountCircle />
                </IconButton>
              </Hidden>
              <Hidden only={["sm", "xs"]}>
                <Button
                  startIcon={<AccountCircle />}
                  edge="end"
                  color="inherit"
                  onClick={event => setProfileMenuAnchor(event.currentTarget)}
                >
                  {user.get("userProfile").get("displayName")}
                </Button>
              </Hidden>
              <Menu
                open={Boolean(profileMenuAnchor)}
                anchorEl={profileMenuAnchor}
                onClose={handleProfileMenuClick}
              >
                <MenuItem
                  component={Link}
                  to="/profile/tasks"
                  onClick={handleProfileMenuClick}
                >
                  My Tasks
                </MenuItem>
                <MenuItem
                  component={Link}
                  to="/profile"
                  onClick={handleProfileMenuClick}
                >
                  Profile
                </MenuItem>
                <MenuItem
                  component={Link}
                  to="/logout"
                  onClick={handleProfileMenuClick}
                >
                  Logout
                </MenuItem>
              </Menu>
            </React.Fragment>
          )
        )}
      </Toolbar>
    </AppBar>
  );
}

AppBarAndDrawer.propTypes = {
  user: PropTypes.object.isRequired,
  onLaunchTwitter: PropTypes.func.isRequired,
};

export default AppBarAndDrawer;
